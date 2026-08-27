import os
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, current_app, url_for, redirect
from sqlalchemy.exc import IntegrityError
from authlib.integrations.flask_client import OAuth
import requests
import hashlib
import secrets
import urllib.parse
import json
import base64

from backend.models import db, User, UserRole, ActivityLog, ActivityType, InviteToken, OrganizationAuthConfig, Organization, Membership, OrganizationStatus, MembershipRole
from backend.auth_utils import (
    hash_password, verify_password,
    generate_access_token, generate_refresh_token,
    decode_token, require_auth, require_role, get_current_user
)

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')


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
    """
    Initiate Microsoft SSO login.
    Query params:
    - org_id: Organization ID (optional, will try to match by email domain or tenant_id)
    - state: CSRF protection state parameter
    """
    org_id = request.args.get('org_id')
    state = request.args.get('state') or secrets.token_urlsafe(32)
    
    # Store state in session for validation
    from flask import session
    session['microsoft_sso_state'] = state
    session['microsoft_sso_org_id'] = org_id
    
    # Use provided Azure credentials or environment config
    tenant_id = os.environ.get('MICROSOFT_TENANT_ID') or current_app.config.get('MICROSOFT_TENANT_ID') or '9e538254-9fc8-4c58-8017-eda881f4d21f'
    client_id = os.environ.get('MICROSOFT_CLIENT_ID') or current_app.config.get('MICROSOFT_CLIENT_ID') or 'e72b3e1b-baa8-4164-99b1-f1b5e7c01eeb'
    redirect_uri = 'http://localhost:5001/api/auth/sso/microsoft/callback'
    
    # Build Microsoft authorization URL
    auth_url = (
        f'https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/authorize'
        f'?client_id={urllib.parse.quote(client_id)}'
        f'&response_type=code'
        f'&redirect_uri={urllib.parse.quote(redirect_uri)}'
        f'&response_mode=query'
        f'&scope={urllib.parse.quote("openid email profile User.Read")}'
        f'&state={urllib.parse.quote(state)}'
    )
    
    if request.args.get('format') == 'json' or 'application/json' in request.headers.get('Accept', ''):
        return jsonify({'auth_url': auth_url})
    return redirect(auth_url)


def _render_sso_response(error=None, access_token=None, refresh_token=None):
    frontend_callback = current_app.config.get('FRONTEND_URL', 'http://localhost:3000') + '/auth/sso/callback'
    if error:
        redirect_url = f"{frontend_callback}?error={urllib.parse.quote(str(error))}"
        error_json = json.dumps(str(error))
        return f'''<!DOCTYPE html>
<html>
<head><title>ThreatShield - SSO Error</title></head>
<body style="font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f9fafb; color: #111827;">
<script>
    if (window.opener && !window.opener.closed) {{
        try {{
            window.opener.postMessage({{type: "GATEKEEPER_SSO_ERROR", error: {error_json}}}, "*");
            window.close();
        }} catch(e) {{
            window.location.href = "{redirect_url}";
        }}
    }} else {{
        window.location.href = "{redirect_url}";
    }}
</script>
<div style="text-align: center;">
    <p>Redirecting back to ThreatShield...</p>
    <p><a href="{redirect_url}">Click here if you are not redirected automatically</a></p>
</div>
</body>
</html>'''
    else:
        redirect_url = f"{frontend_callback}?access_token={urllib.parse.quote(access_token)}&refresh_token={urllib.parse.quote(refresh_token)}"
        token_a_json = json.dumps(access_token)
        token_r_json = json.dumps(refresh_token)
        return f'''<!DOCTYPE html>
<html>
<head><title>ThreatShield - Signing In...</title></head>
<body style="font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f9fafb; color: #111827;">
<script>
    if (window.opener && !window.opener.closed) {{
        try {{
            window.opener.postMessage({{
                type: "GATEKEEPER_SSO_SUCCESS",
                accessToken: {token_a_json},
                refreshToken: {token_r_json}
            }}, "*");
            window.close();
        }} catch(e) {{
            window.location.href = "{redirect_url}";
        }}
    }} else {{
        window.location.href = "{redirect_url}";
    }}
</script>
<div style="text-align: center;">
    <p>Signing in to ThreatShield...</p>
    <p><a href="{redirect_url}">Click here if you are not redirected automatically</a></p>
</div>
</body>
</html>'''


@auth_bp.get('/sso/microsoft/callback')
def sso_microsoft_callback():
    code = request.args.get('code')
    state = request.args.get('state')
    error = request.args.get('error')
    error_description = request.args.get('error_description')
    
    if error:
        current_app.logger.error(f'Microsoft SSO error: {error} - {error_description}')
        return _render_sso_response(error=error_description or error)
    
    if not code:
        return _render_sso_response(error="Authorization code not received")
    
    # Microsoft credentials
    tenant_id = os.environ.get('MICROSOFT_TENANT_ID') or current_app.config.get('MICROSOFT_TENANT_ID') or '9e538254-9fc8-4c58-8017-eda881f4d21f'
    client_id = os.environ.get('MICROSOFT_CLIENT_ID') or current_app.config.get('MICROSOFT_CLIENT_ID') or 'e72b3e1b-baa8-4164-99b1-f1b5e7c01eeb'
    client_secret = os.environ.get('MICROSOFT_CLIENT_SECRET') or current_app.config.get('MICROSOFT_CLIENT_SECRET') or 'XjX8Q~9cQWMugu31S1j.fOcBR4gywCIDcmUnUbuI'
    redirect_uri = 'http://localhost:5001/api/auth/sso/microsoft/callback'
    
    try:
        # Exchange authorization code for access token
        token_url = f'https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token'
        token_data = {
            'client_id': client_id,
            'client_secret': client_secret,
            'code': code,
            'redirect_uri': redirect_uri,
            'grant_type': 'authorization_code',
            'scope': 'openid email profile'
        }
        
        token_response = requests.post(token_url, data=token_data)
        token_json = token_response.json()
        
        if 'error' in token_json:
            current_app.logger.error(f'Token exchange error: {token_json}')
            return _render_sso_response(error=token_json.get("error_description", "Token exchange failed"))
        
        access_token_ms = token_json.get('access_token')
        
        if not access_token_ms:
            return _render_sso_response(error="No access token received from Microsoft")
        
        email = None
        first_name = ''
        last_name = ''

        # Parse ID token for user claims if available
        id_token = token_json.get('id_token')
        if id_token:
            try:
                parts = id_token.split('.')
                if len(parts) >= 2:
                    payload_b64 = parts[1] + '=' * (-len(parts[1]) % 4)
                    claims = json.loads(base64.urlsafe_b64decode(payload_b64.encode('utf-8')))
                    email = (claims.get('email') or claims.get('preferred_username') or claims.get('upn') or '').strip().lower()
                    first_name = (claims.get('given_name') or '').strip()
                    last_name = (claims.get('family_name') or '').strip()
                    if not first_name and claims.get('name'):
                        first_name = claims.get('name')
            except Exception as e:
                current_app.logger.warning(f'Could not parse id_token claims: {e}')

        # If email not found from id_token, fetch user info from Microsoft Graph
        if not email:
            graph_url = 'https://graph.microsoft.com/v1.0/me'
            headers = {'Authorization': f'Bearer {access_token_ms}'}
            user_response = requests.get(graph_url, headers=headers)
            userinfo = user_response.json()
            
            if 'error' not in userinfo:
                email = (userinfo.get('mail') or userinfo.get('userPrincipalName') or '').strip().lower()
                first_name = first_name or (userinfo.get('givenName') or '').strip()
                last_name = last_name or (userinfo.get('surname') or '').strip()

        if not email:
            return _render_sso_response(error="Could not retrieve email from Microsoft account")
        
        # Fetch user's group memberships from Microsoft Graph (if available)
        user_group_ids = set()
        try:
            group_url = 'https://graph.microsoft.com/v1.0/me/memberOf/microsoft.graph.group'
            group_headers = {'Authorization': f'Bearer {access_token_ms}'}
            group_response = requests.get(group_url, headers=group_headers)
            groups_data = group_response.json()
            if 'value' in groups_data:
                for group in groups_data['value']:
                    g_id = group.get('id')
                    if g_id:
                        user_group_ids.add(g_id)
        except Exception as e:
            current_app.logger.warning(f'Could not fetch group memberships: {e}')
        
        # Determine role from group membership or default to USER
        super_admin_group_id = current_app.config.get('SUPER_ADMIN_GROUP_ID')
        org_admin_group_id = current_app.config.get('ORG_ADMIN_GROUP_ID')
        user_group_id = current_app.config.get('USER_GROUP_ID')
        
        assigned_role = None
        if super_admin_group_id and super_admin_group_id in user_group_ids:
            assigned_role = UserRole.SUPER_ADMIN
        elif org_admin_group_id and org_admin_group_id in user_group_ids:
            assigned_role = UserRole.ORG_ADMIN
        elif user_group_id and user_group_id in user_group_ids:
            assigned_role = UserRole.USER

        # Default to USER role if no specific group IDs match
        if not assigned_role:
            assigned_role = UserRole.USER
        
        # Find or auto-provision default organization & auth config
        org = Organization.query.first()
        if not org:
            org = Organization(
                name="ThreatShield Organization",
                slug="threatshield-org",
                status=OrganizationStatus.ACTIVE,
                plan_name="Enterprise",
                plan_status="active",
                max_users=1000,
                scans_per_month=10000,
                monthly_scan_limit=10000,
                settings={},
                sso_config={}
            )
            db.session.add(org)
            db.session.commit()
        
        auth_config = OrganizationAuthConfig.query.filter_by(organization_id=org.id).first()
        if not auth_config:
            auth_config = OrganizationAuthConfig(
                organization_id=org.id,
                password_enabled=True,
                sso_enabled=True,
                email_auth_enabled=True,
                sso_provider='microsoft',
                sso_tenant_id=tenant_id
            )
            db.session.add(auth_config)
            db.session.commit()
        
        # Find or create user
        user = User.query.filter_by(email=email).first()
        if not user:
            user = User(
                email=email,
                first_name=first_name or email.split('@')[0],
                last_name=last_name or 'User',
                role=assigned_role,
                is_active=True,
                is_verified=True,
                auth_method='sso'
            )
            db.session.add(user)
            db.session.commit()
            
            # Create membership in the organization
            membership = Membership(
                user_id=user.id,
                organization_id=org.id,
                role=MembershipRole.MEMBER
            )
            db.session.add(membership)
            db.session.commit()
            
            db.session.add(ActivityLog(
                user_id=user.id,
                type=ActivityType.USER_REGISTER,
                description=f'User registered via Microsoft SSO: {email}',
                ip_address=request.remote_addr,
                user_agent=request.headers.get('User-Agent')
            ))
            db.session.commit()
        else:
            if user.auth_method != 'sso':
                user.auth_method = 'sso'
            db.session.commit()
            
            existing_membership = Membership.query.filter_by(
                user_id=user.id,
                organization_id=org.id
            ).first()
            if not existing_membership:
                membership = Membership(
                    user_id=user.id,
                    organization_id=org.id,
                    role=MembershipRole.MEMBER
                )
                db.session.add(membership)
                db.session.commit()
        
        if not user.is_active:
            return _render_sso_response(error="Account is deactivated")
        
        user.last_login = datetime.utcnow()
        user.is_verified = True
        db.session.commit()
        
        primary_org = str(org.id)
        
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
        
        return _render_sso_response(access_token=access_token, refresh_token=refresh_token)
        
    except Exception as e:
        current_app.logger.error(f'Microsoft SSO error: {e}')
        return _render_sso_response(error=str(e))


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


@auth_bp.get('/invite/<token>')
def validate_invite_token(token):
    """Validate an invitation token without accepting it."""
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    invite = InviteToken.query.filter_by(token_hash=token_hash).first() or InviteToken.query.filter_by(token_hash=token).first()

    if not invite:
        return jsonify({'error': 'Invalid invitation token'}), 404

    if invite.accepted_at:
        return jsonify({'error': 'Invitation has already been accepted'}), 400

    if invite.expires_at < datetime.utcnow():
        return jsonify({'error': 'Invitation has expired'}), 400

    return jsonify({
        'valid': True,
        'email': invite.email,
        'first_name': invite.first_name,
        'last_name': invite.last_name,
        'organization_name': invite.organization.name,
        'expires_at': invite.expires_at.isoformat(),
    })


@auth_bp.post('/invite/<token>/accept')
def accept_invite_token(token):
    """Accept an invitation and create/link the user account."""
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    invite = InviteToken.query.filter_by(token_hash=token_hash).first() or InviteToken.query.filter_by(token_hash=token).first()

    if not invite:
        return jsonify({'error': 'Invalid invitation token'}), 404

    if invite.accepted_at:
        return jsonify({'error': 'Invitation has already been accepted'}), 400

    if invite.expires_at < datetime.utcnow():
        return jsonify({'error': 'Invitation has expired'}), 400

    data = request.get_json(silent=True) or {}
    password = data.get('password') or ''

    if not password:
        return jsonify({'error': 'Password is required'}), 400

    if len(password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters'}), 400

    org = invite.organization
    from backend.auth_utils import hash_password

    user = User.query.filter_by(email=invite.email).first()

    # Check license limits before creating or activating user
    active_users = User.query.join(Membership).filter(
        Membership.organization_id == org.id,
        User.role == UserRole.USER,
        User.is_active == True
    ).count()

    if (not user or not user.is_active) and active_users >= org.max_users:
        return jsonify({'error': 'License seat limit reached'}), 403

    if user:
        if not user.password_hash:
            user.password_hash = hash_password(password)
        user.is_active = True
        user.is_verified = True
        user.is_provisioned = True
        user.deprovisioned_at = None
    else:
        user = User(
            email=invite.email,
            password_hash=hash_password(password),
            first_name=invite.first_name,
            last_name=invite.last_name,
            role=UserRole.USER,
            is_active=True,
            is_verified=True,
            is_provisioned=True,
            deprovisioned_at=None,
            auth_method='password'
        )
        db.session.add(user)
        db.session.flush()

    # Ensure membership exists
    existing_membership = Membership.query.filter_by(user_id=user.id, organization_id=org.id).first()
    if not existing_membership:
        membership = Membership(
            user_id=user.id,
            organization_id=org.id,
            role=MembershipRole.MEMBER
        )
        db.session.add(membership)

    # Mark invitation as accepted
    invite.accepted_at = datetime.utcnow()
    db.session.commit()

    db.session.add(ActivityLog(
        user_id=user.id,
        organization_id=org.id,
        type=ActivityType.USER_INVITE_ACCEPTED,
        description=f'User accepted invitation: {invite.email}',
        activity_metadata={'invite_id': str(invite.id), 'email': invite.email},
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    ))
    db.session.commit()

    # Generate tokens for the new user
    access_token = generate_access_token(str(user.id), user.role.value, str(org.id))
    refresh_token = generate_refresh_token(str(user.id))

    return jsonify({
        'user': user.to_dict(include_sensitive=True),
        'access_token': access_token,
        'refresh_token': refresh_token
    }), 201