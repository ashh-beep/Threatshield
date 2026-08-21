from datetime import datetime
from flask import Blueprint, request, jsonify, current_app, url_for
from sqlalchemy.exc import IntegrityError
from authlib.integrations.flask_client import OAuth
import requests

from backend.models import db, User, UserRole, ActivityLog, ActivityType
from backend.auth_utils import (
    hash_password, verify_password,
    generate_access_token, generate_refresh_token,
    decode_token, require_auth, require_role, get_current_user
)

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

oauth = OAuth()

def init_oauth(app):
    oauth.init_app(app)
    if app.config.get('MICROSOFT_CLIENT_ID') and app.config.get('MICROSOFT_CLIENT_SECRET'):
        oauth.register(
            name='microsoft',
            client_id=app.config['MICROSOFT_CLIENT_ID'],
            client_secret=app.config['MICROSOFT_CLIENT_SECRET'],
            server_metadata_url=f'https://login.microsoftonline.com/{app.config["MICROSOFT_TENANT_ID"]}/v2.0/.well-known/openid-configuration',
            client_kwargs={'scope': 'openid email profile'},
        )


@auth_bp.post('/register')
def register():
    data = request.get_json(silent=True) or {}
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''
    first_name = (data.get('first_name') or '').strip()
    last_name = (data.get('last_name') or '').strip()

    if not email or not password or not first_name or not last_name:
        return jsonify({'error': 'All fields are required'}), 400

    if len(password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters'}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Email already registered'}), 409

    user = User(
        email=email,
        password_hash=hash_password(password),
        first_name=first_name,
        last_name=last_name,
        role=UserRole.USER,
        is_verified=False
    )
    db.session.add(user)
    db.session.commit()

    db.session.add(ActivityLog(
        user_id=user.id,
        type=ActivityType.USER_REGISTER,
        description=f'User registered: {email}',
        activity_metadata={},
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    ))
    db.session.commit()

    access_token = generate_access_token(str(user.id), user.role.value)
    refresh_token = generate_refresh_token(str(user.id))

    return jsonify({
        'user': user.to_dict(),
        'access_token': access_token,
        'refresh_token': refresh_token
    }), 201


@auth_bp.post('/login')
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''

    if not email or not password:
        return jsonify({'error': 'Email and password required'}), 400

    user = User.query.filter_by(email=email).first()
    if not user or not user.password_hash:
        return jsonify({'error': 'Invalid credentials'}), 401

    if not verify_password(user.password_hash, password):
        return jsonify({'error': 'Invalid credentials'}), 401

    if not user.is_active:
        return jsonify({'error': 'Account is deactivated'}), 403

    primary_org = None
    membership = user.memberships[0] if user.memberships else None
    if membership:
        primary_org = str(membership.organization_id)

    user.last_login = datetime.utcnow()
    db.session.add(user)

    db.session.add(ActivityLog(
        user_id=user.id,
        type=ActivityType.USER_LOGIN,
        description=f'User logged in: {email}',
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    ))
    db.session.commit()

    access_token = generate_access_token(str(user.id), user.role.value, primary_org)
    refresh_token = generate_refresh_token(str(user.id))

    return jsonify({
        'user': user.to_dict(include_sensitive=True),
        'access_token': access_token,
        'refresh_token': refresh_token
    })


@auth_bp.post('/logout')
@require_auth
def logout():
    user_id = get_current_user()['sub']
    db.session.add(ActivityLog(
        user_id=user_id,
        type=ActivityType.USER_LOGOUT,
        description='User logged out',
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    ))
    db.session.commit()
    return jsonify({'message': 'Logged out successfully'})


@auth_bp.post('/refresh')
def refresh():
    data = request.get_json(silent=True) or {}
    refresh_token = data.get('refresh_token')

    if not refresh_token:
        return jsonify({'error': 'Refresh token required'}), 400

    try:
        payload = decode_token(refresh_token)
        if payload.get('type') != 'refresh':
            return jsonify({'error': 'Invalid token type'}), 401
    except ValueError as e:
        return jsonify({'error': str(e)}), 401

    user_id = payload['sub']
    user = User.query.get(user_id)
    if not user or not user.is_active:
        return jsonify({'error': 'User not found or deactivated'}), 401

    primary_org = None
    membership = user.memberships[0] if user.memberships else None
    if membership:
        primary_org = str(membership.organization_id)

    access_token = generate_access_token(str(user.id), user.role.value, primary_org)
    new_refresh_token = generate_refresh_token(str(user.id))

    return jsonify({
        'access_token': access_token,
        'refresh_token': new_refresh_token
    })


@auth_bp.get('/me')
@require_auth
def me():
    user_id = get_current_user()['sub']
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    return jsonify({'user': user.to_dict(include_sensitive=True)})


@auth_bp.patch('/me')
@require_auth
def update_profile():
    user_id = get_current_user()['sub']
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    data = request.get_json(silent=True) or {}
    first_name = (data.get('first_name') or '').strip()
    last_name = (data.get('last_name') or '').strip()

    if first_name:
        user.first_name = first_name
    if last_name:
        user.last_name = last_name

    db.session.commit()
    return jsonify({'user': user.to_dict(include_sensitive=True)})


@auth_bp.post('/change-password')
@require_auth
def change_password():
    user_id = get_current_user()['sub']
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    data = request.get_json(silent=True) or {}
    current_password = data.get('current_password') or ''
    new_password = data.get('new_password') or ''

    if not current_password or not new_password:
        return jsonify({'error': 'Current and new password required'}), 400

    if len(new_password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters'}), 400

    if not user.password_hash or not verify_password(user.password_hash, current_password):
        return jsonify({'error': 'Current password is incorrect'}), 401

    user.password_hash = hash_password(new_password)
    db.session.commit()

    db.session.add(ActivityLog(
        user_id=user.id,
        type=ActivityType.USER_PASSWORD_RESET,
        description='User changed password',
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    ))
    db.session.commit()

    return jsonify({'message': 'Password changed successfully'})


@auth_bp.post('/forgot-password')
def forgot_password():
    data = request.get_json(silent=True) or {}
    email = (data.get('email') or '').strip().lower()

    if not email:
        return jsonify({'error': 'Email required'}), 400

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({'message': 'If the email exists, a reset link will be sent'})

    reset_token = generate_refresh_token(str(user.id))
    reset_url = f"{current_app.config['FRONTEND_URL']}/reset-password?token={reset_token}"

    # TODO: Send email with reset_url
    current_app.logger.info(f'Password reset requested for {email}: {reset_url}')

    db.session.add(ActivityLog(
        user_id=user.id,
        type=ActivityType.USER_PASSWORD_RESET,
        description='Password reset requested',
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    ))
    db.session.commit()

    return jsonify({'message': 'If the email exists, a reset link will be sent'})


@auth_bp.post('/reset-password')
def reset_password():
    data = request.get_json(silent=True) or {}
    token = data.get('token')
    new_password = data.get('new_password') or ''

    if not token or not new_password:
        return jsonify({'error': 'Token and new password required'}), 400

    if len(new_password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters'}), 400

    try:
        payload = decode_token(token)
        if payload.get('type') != 'refresh':
            return jsonify({'error': 'Invalid token'}), 401
    except ValueError as e:
        return jsonify({'error': str(e)}), 401

    user_id = payload['sub']
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    user.password_hash = hash_password(new_password)
    db.session.commit()

    db.session.add(ActivityLog(
        user_id=user.id,
        type=ActivityType.USER_PASSWORD_RESET,
        description='Password reset completed',
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    ))
    db.session.commit()

    return jsonify({'message': 'Password reset successfully'})


@auth_bp.get('/sso/microsoft')
def sso_microsoft_login():
    if not current_app.config.get('MICROSOFT_CLIENT_ID'):
        return jsonify({'error': 'SSO not configured'}), 501

    redirect_uri = url_for('auth.sso_microsoft_callback', _external=True)
    return oauth.microsoft.authorize_redirect(redirect_uri)


@auth_bp.get('/sso/microsoft/callback')
def sso_microsoft_callback():
    if not current_app.config.get('MICROSOFT_CLIENT_ID'):
        return jsonify({'error': 'SSO not configured'}), 501

    try:
        token = oauth.microsoft.authorize_access_token()
        userinfo = token.get('userinfo')
        if not userinfo:
            resp = oauth.microsoft.get('https://graph.microsoft.com/v1.0/me')
            userinfo = resp.json()

        email = (userinfo.get('mail') or userinfo.get('userPrincipalName') or '').strip().lower()
        first_name = (userinfo.get('givenName') or '').strip()
        last_name = (userinfo.get('surname') or '').strip()

        if not email:
            return jsonify({'error': 'Could not retrieve email from Microsoft'}), 400

        user = User.query.filter_by(email=email).first()
        if not user:
            user = User(
                email=email,
                first_name=first_name or email.split('@')[0],
                last_name=last_name or '',
                role=UserRole.USER,
                is_verified=True
            )
            db.session.add(user)
            db.session.commit()

            db.session.add(ActivityLog(
                user_id=user.id,
                type=ActivityType.USER_REGISTER,
                description=f'User registered via Microsoft SSO: {email}',
                ip_address=request.remote_addr,
                user_agent=request.headers.get('User-Agent')
            ))
            db.session.commit()

        if not user.is_active:
            return jsonify({'error': 'Account is deactivated'}), 403

        user.last_login = datetime.utcnow()
        user.is_verified = True
        db.session.commit()

        primary_org = None
        membership = user.memberships[0] if user.memberships else None
        if membership:
            primary_org = str(membership.organization_id)

        db.session.add(ActivityLog(
            user_id=user.id,
            type=ActivityType.USER_SSO_LOGIN,
            description=f'User logged in via Microsoft SSO: {email}',
            ip_address=request.remote_addr,
            user_agent=request.headers.get('User-Agent')
        ))
        db.session.commit()

        access_token = generate_access_token(str(user.id), user.role.value, primary_org)
        refresh_token = generate_refresh_token(str(user.id))

        frontend_url = current_app.config['FRONTEND_URL']
        return f'<script>window.opener.postMessage({{type: "GATEKEEPER_SSO_SUCCESS", accessToken: "{access_token}", refreshToken: "{refresh_token}"}}, "*"); window.close();</script>'

    except Exception as e:
        current_app.logger.error(f'Microsoft SSO error: {e}')
        frontend_url = current_app.config['FRONTEND_URL']
        return f'<script>window.opener.postMessage({{type: "GATEKEEPER_SSO_ERROR", error: "{str(e)}"}}, "*"); window.close();</script>'


@auth_bp.post('/break-glass')
def break_glass():
    data = request.get_json(silent=True) or {}
    key = data.get('key')
    email = (data.get('email') or '').strip().lower()

    if not key or not email:
        return jsonify({'error': 'Key and email required'}), 400

    if key != current_app.config.get('BREAKGLASS_KEY'):
        return jsonify({'error': 'Invalid break-glass key'}), 401

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({'error': 'User not found'}), 404

    if user.role != UserRole.SUPER_ADMIN:
        return jsonify({'error': 'Break-glass only available for super admins'}), 403

    primary_org = None
    membership = user.memberships[0] if user.memberships else None
    if membership:
        primary_org = str(membership.organization_id)

    access_token = generate_access_token(str(user.id), user.role.value, primary_org)
    refresh_token = generate_refresh_token(str(user.id))

    db.session.add(ActivityLog(
        user_id=user.id,
        type=ActivityType.USER_LOGIN,
        description=f'Break-glass access used for: {email}',
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    ))
    db.session.commit()

    return jsonify({
        'user': user.to_dict(include_sensitive=True),
        'access_token': access_token,
        'refresh_token': refresh_token
    })


@auth_bp.post('/extension/link')
@require_auth
def link_extension():
    user_id = get_current_user()['sub']
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    import secrets
    extension_token = secrets.token_urlsafe(32)
    user.extension_token = extension_token
    user.extension_linked_at = datetime.utcnow()
    db.session.commit()

    db.session.add(ActivityLog(
        user_id=user.id,
        type=ActivityType.EXTENSION_LINKED,
        description='Extension linked to account',
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    ))
    db.session.commit()

    return jsonify({
        'extension_token': extension_token,
        'message': 'Extension linked successfully'
    })


@auth_bp.post('/extension/unlink')
@require_auth
def unlink_extension():
    user_id = get_current_user()['sub']
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    user.extension_token = None
    user.extension_linked_at = None
    db.session.commit()

    db.session.add(ActivityLog(
        user_id=user.id,
        type=ActivityType.EXTENSION_UNLINKED,
        description='Extension unlinked from account',
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    ))
    db.session.commit()

    return jsonify({'message': 'Extension unlinked successfully'})


@auth_bp.get('/extension/status')
@require_auth
def extension_status():
    user_id = get_current_user()['sub']
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    return jsonify({
        'linked': user.extension_token is not None,
        'linked_at': user.extension_linked_at.isoformat() if user.extension_linked_at else None
    })