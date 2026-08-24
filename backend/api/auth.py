from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, current_app, url_for
from sqlalchemy.exc import IntegrityError
from authlib.integrations.flask_client import OAuth
import requests
import hashlib
import secrets
import urllib.parse

from backend.models import db, User, UserRole, ActivityLog, ActivityType, InviteToken, OrganizationAuthConfig, Organization, Membership
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
    
    # Use provided Azure credentials
    tenant_id = '9e538254-9fc8-4c58-8017-eda881f4d21f'
    client_id = 'e72b3e1b-baa8-4164-99b1-f1b5e7c01eeb'
    redirect_uri = 'http://localhost:5001/api/auth/sso/microsoft/callback'
    
    # Build Microsoft authorization URL
    auth_url = (
        f'https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/authorize'
        f'?client_id={urllib.parse.quote(client_id)}'
        f'&response_type=code'
        f'&redirect_uri={urllib.parse.quote(redirect_uri)}'
        f'&response_mode=query'
        f'&scope={urllib.parse.quote("openid email profile")}'
        f'&state={urllib.parse.quote(state)}'
    )
    
    return jsonify({'auth_url': auth_url})


@auth_bp.get('/sso/microsoft/callback')
def sso_microsoft_callback():
    code = request.args.get('code')
    state = request.args.get('state')
    error = request.args.get('error')
    error_description = request.args.get('error_description')
    
    # Validate state parameter (CSRF protection)
    from flask import session
    stored_state = session.pop('microsoft_sso_state', None)
    org_id = session.pop('microsoft_sso_org_id', None)
    
    if error:
        current_app.logger.error(f'Microsoft SSO error: {error} - {error_description}')
        frontend_url = current_app.config['FRONTEND_URL']
        return f'<script>window.opener.postMessage({{type: "GATEKEEPER_SSO_ERROR", error: "{error_description or error}"}}, "*"); window.close();</script>'
    
    if not code:
        return f'<script>window.opener.postMessage({{type: "GATEKEEPER_SSO_ERROR", error: "Authorization code not received"}}, "*"); window.close();</script>'
    
    if not state or state != stored_state:
        return f'<script>window.opener.postMessage({{type: "GATEKEEPER_SSO_ERROR", error: "Invalid state parameter"}}, "*"); window.close();</script>'
    
    # Microsoft credentials
    tenant_id = '9e538254-9fc8-4c58-8017-eda881f4d21f'
    client_id = 'e72b3e1b-baa8-4164-99b1-f1b5e7c01eeb'
    client_secret = '2e190dc5-941b-4b88-96c6-8704f3337e4f'
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
            return f'<script>window.opener.postMessage({{type: "GATEKEEPER_SSO_ERROR", error: "{token_json.get("error_description", "Token exchange failed")}"}}, "*"); window.close();</script>'
        
        access_token_ms = token_json.get('access_token')
        id_token = token_json.get('id_token')
        
        if not access_token_ms:
            return f'<script>window.opener.postMessage({{type: "GATEKEEPER_SSO_ERROR", error: "No access token received"}}, "*"); window.close();</script>'
        
        # Fetch user info from Microsoft Graph
        graph_url = 'https://graph.microsoft.com/v1.0/me'
        headers = {'Authorization': f'Bearer {access_token_ms}'}
        user_response = requests.get(graph_url, headers=headers)
        userinfo = user_response.json()
        
        if 'error' in userinfo:
            current_app.logger.error(f'Graph API error: {userinfo}')
            return f'<script>window.opener.postMessage({{type: "GATEKEEPER_SSO_ERROR", error: "Failed to fetch user info from Microsoft Graph"}}, "*"); window.close();</script>'
        
        email = (userinfo.get('mail') or userinfo.get('userPrincipalName') or '').strip().lower()
        first_name = (userinfo.get('givenName') or '').strip()
        last_name = (userinfo.get('surname') or '').strip()
        
        if not email:
            return f'<script>window.opener.postMessage({{type: "GATEKEEPER_SSO_ERROR", error: "Could not retrieve email from Microsoft"}}, "*"); window.close();</script>'
        
        # Fetch user's group memberships from Microsoft Graph
        group_url = 'https://graph.microsoft.com/v1.0/me/memberOf/microsoft.graph.group'
        group_headers = {'Authorization': f'Bearer {access_token_ms}'}
        group_response = requests.get(group_url, headers=group_headers)
        groups_data = group_response.json()
        
        user_group_ids = set()
        if 'value' in groups_data:
            for group in groups_data['value']:
                group_id = group.get('id')
                if group_id:
                    user_group_ids.add(group_id)
        
        # Determine role from group membership
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
        
        if not assigned_role:
            return f'<script>window.opener.postMessage({{type: "GATEKEEPER_SSO_ERROR", error: "You are not assigned to any ThreatShield group."}}, "*"); window.close();</script>'
        
        # Find organization using tenant_id OR email domain
        auth_config = None
        if org_id:
            auth_config = OrganizationAuthConfig.query.filter_by(organization_id=org_id).first()
        
        if not auth_config:
            # Try to find by email domain
            email_domain = email.split('@')[1] if '@' in email else None
            if email_domain:
                auth_config = OrganizationAuthConfig.query.filter_by(
                    sso_enabled=True, 
                    sso_provider='microsoft',
                    sso_domain=email_domain
                ).first()
        
        if not auth_config:
            # Try to find by tenant_id
            auth_config = OrganizationAuthConfig.query.filter_by(
                sso_enabled=True,
                sso_provider='microsoft',
                sso_tenant_id=tenant_id
            ).first()
        
        if not auth_config or not auth_config.sso_enabled:
            return f'<script>window.opener.postMessage({{type: "GATEKEEPER_SSO_ERROR", error: "SSO not configured for this organization"}}, "*"); window.close();</script>'
        
        if auth_config.sso_provider != 'microsoft':
            return f'<script>window.opener.postMessage({{type: "GATEKEEPER_SSO_ERROR", error: "SSO provider is not Microsoft"}}, "*"); window.close();</script>'
        
        # Verify email domain matches if configured
        if auth_config.sso_domain:
            email_domain = email.split('@')[1] if '@' in email else None
            if email_domain != auth_config.sso_domain:
                return f'<script>window.opener.postMessage({{type: "GATEKEEPER_SSO_ERROR", error: "Email domain not allowed for this organization"}}, "*"); window.close();</script>'
        
        # Find or create user
        user = User.query.filter_by(email=email).first()
        if not user:
            user = User(
                email=email,
                first_name=first_name or email.split('@')[0],
                last_name=last_name or '',
                role=assigned_role,
                is_verified=True,
                auth_method='sso'
            )
            db.session.add(user)
            db.session.commit()
            
            # Create membership in the organization
            membership = Membership(
                user_id=user.id,
                organization_id=auth_config.organization_id,
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
            # Update auth_method if user existed
            if user.auth_method != 'sso':
                user.auth_method = 'sso'
            
            # Update role based on current group membership
            if user.role != assigned_role:
                user.role = assigned_role
            
            db.session.commit()
            
            # Ensure user has membership in the organization
            existing_membership = Membership.query.filter_by(
                user_id=user.id,
                organization_id=auth_config.organization_id
            ).first()
            if not existing_membership:
                membership = Membership(
                    user_id=user.id,
                    organization_id=auth_config.organization_id,
                    role=MembershipRole.MEMBER
                )
                db.session.add(membership)
                db.session.commit()
        
        if not user.is_active:
            return f'<script>window.opener.postMessage({{type: "GATEKEEPER_SSO_ERROR", error: "Account is deactivated"}}, "*"); window.close();</script>'
        
        user.last_login = datetime.utcnow()
        user.is_verified = True
        db.session.commit()
        
        primary_org = str(auth_config.organization_id)
        
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
        
        # Redirect to frontend callback with tokens
        frontend_url = 'http://localhost:3000/auth/sso/callback'
        redirect_url = f'{frontend_url}?access_token={urllib.parse.quote(access_token)}&refresh_token={urllib.parse.quote(refresh_token)}'
        
        return f'<script>window.location.href = "{redirect_url}";</script>'
        
    except Exception as e:
        current_app.logger.error(f'Microsoft SSO error: {e}')
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


@auth_bp.get('/invite/<token>')
def validate_invite_token(token):
    """Validate an invitation token without accepting it."""
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    invite = InviteToken.query.filter_by(token_hash=token_hash).first()

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
    """Accept an invitation and create the user account."""
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    invite = InviteToken.query.filter_by(token_hash=token_hash).first()

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

    # Check if user already exists
    if User.query.filter_by(email=invite.email).first():
        return jsonify({'error': 'User with this email already exists'}), 409

    org = invite.organization
    
    # Check license limits
    current_users = User.query.join(Membership).filter(
        Membership.organization_id == org.id,
        User.role == UserRole.USER
    ).count()
    
    if current_users >= org.max_users:
        return jsonify({'error': 'License limit reached for this organization'}), 403

    from backend.auth_utils import hash_password
    user = User(
        email=invite.email,
        password_hash=hash_password(password),
        first_name=invite.first_name,
        last_name=invite.last_name,
        role=UserRole.USER,
        is_active=True,
        is_verified=True,
        is_provisioned=True,
        auth_method='password'
    )
    db.session.add(user)
    db.session.flush()

    # Create membership
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
        metadata={'invite_id': str(invite.id)},
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