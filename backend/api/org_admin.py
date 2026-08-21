from flask import Blueprint, request, jsonify, g
from sqlalchemy import func, or_

from backend.models import (
    db, User, UserRole, Organization, OrganizationStatus, 
    Membership, MembershipRole, ActivityLog, ActivityType,
    OrganizationAuthConfig
)
from backend.auth_utils import require_auth, require_role, get_current_user

org_admin_bp = Blueprint('org_admin', __name__, url_prefix='/api/org-admin')


def get_admin_organization_id():
    """Get the organization ID from the authenticated org_admin's membership/JWT."""
    user = get_current_user()
    if not user:
        return None
    
    org_id = user.get('org_id')
    if org_id:
        return org_id
    
    # Fallback: look up from membership
    membership = Membership.query.filter_by(user_id=user['sub']).first()
    if membership:
        return str(membership.organization_id)
    
    return None


@org_admin_bp.get('/dashboard')
@require_role('org_admin')
def org_admin_dashboard():
    org_id = get_admin_organization_id()
    if not org_id:
        return jsonify({'error': 'Organization not found for admin'}), 404

    org = Organization.query.get(org_id)
    if not org:
        return jsonify({'error': 'Organization not found'}), 404

    # Statistics
    total_users = User.query.join(Membership).filter(
        Membership.organization_id == org_id,
        User.role == UserRole.USER
    ).count()

    active_users = User.query.join(Membership).filter(
        Membership.organization_id == org_id,
        User.role == UserRole.USER,
        User.is_active == True,
        User.is_provisioned == True
    ).count()

    provisioned_users = User.query.join(Membership).filter(
        Membership.organization_id == org_id,
        User.role == UserRole.USER,
        User.is_provisioned == True
    ).count()

    deprovisioned_users = User.query.join(Membership).filter(
        Membership.organization_id == org_id,
        User.role == UserRole.USER,
        User.is_provisioned == False
    ).count()

    sso_users = User.query.join(Membership).filter(
        Membership.organization_id == org_id,
        User.role == UserRole.USER,
        User.auth_method == 'sso'
    ).count()

    password_users = User.query.join(Membership).filter(
        Membership.organization_id == org_id,
        User.role == UserRole.USER,
        User.auth_method == 'password'
    ).count()

    email_auth_users = User.query.join(Membership).filter(
        Membership.organization_id == org_id,
        User.role == UserRole.USER,
        User.auth_method == 'email_auth'
    ).count()

    # Recent activity
    recent_activity = ActivityLog.query.filter_by(organization_id=org_id).order_by(
        ActivityLog.created_at.desc()
    ).limit(10).all()

    return jsonify({
        'organization': org.to_dict(include_sensitive=True),
        'statistics': {
            'total_users': total_users,
            'active_users': active_users,
            'provisioned_users': provisioned_users,
            'deprovisioned_users': deprovisioned_users,
            'sso_users': sso_users,
            'password_users': password_users,
            'email_auth_users': email_auth_users
        },
        'recent_activity': [a.to_dict() for a in recent_activity]
    })


@org_admin_bp.get('/users')
@require_role('org_admin')
def org_admin_list_users():
    org_id = get_admin_organization_id()
    if not org_id:
        return jsonify({'error': 'Organization not found for admin'}), 404

    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 20, type=int), 100)
    search = request.args.get('search', '').strip()
    status_filter = request.args.get('status')  # active, inactive, provisioned, deprovisioned
    auth_method_filter = request.args.get('auth_method')

    query = User.query.join(Membership).filter(
        Membership.organization_id == org_id,
        User.role == UserRole.USER
    )

    if search:
        query = query.filter(
            or_(
                User.email.ilike(f'%{search}%'),
                User.first_name.ilike(f'%{search}%'),
                User.last_name.ilike(f'%{search}%')
            )
        )

    if status_filter == 'active':
        query = query.filter(User.is_active == True, User.is_provisioned == True)
    elif status_filter == 'inactive':
        query = query.filter(or_(User.is_active == False, User.is_provisioned == False))
    elif status_filter == 'provisioned':
        query = query.filter(User.is_provisioned == True)
    elif status_filter == 'deprovisioned':
        query = query.filter(User.is_provisioned == False)

    if auth_method_filter:
        query = query.filter(User.auth_method == auth_method_filter)

    pagination = query.order_by(User.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    return jsonify({
        'users': [u.to_dict(include_sensitive=True) for u in pagination.items],
        'pagination': {
            'page': pagination.page,
            'per_page': pagination.per_page,
            'total': pagination.total,
            'pages': pagination.pages
        }
    })


@org_admin_bp.get('/users/<user_id>')
@require_role('org_admin')
def org_admin_get_user(user_id):
    org_id = get_admin_organization_id()
    if not org_id:
        return jsonify({'error': 'Organization not found for admin'}), 404

    user = User.query.join(Membership).filter(
        Membership.organization_id == org_id,
        User.id == user_id
    ).first()

    if not user:
        return jsonify({'error': 'User not found in your organization'}), 404

    return jsonify({'user': user.to_dict(include_sensitive=True)})


@org_admin_bp.post('/users')
@require_role('org_admin')
def org_admin_create_user():
    org_id = get_admin_organization_id()
    if not org_id:
        return jsonify({'error': 'Organization not found for admin'}), 404

    org = Organization.query.get(org_id)
    if not org:
        return jsonify({'error': 'Organization not found'}), 404

    data = request.get_json(silent=True) or {}
    email = (data.get('email') or '').strip().lower()
    first_name = (data.get('first_name') or '').strip()
    last_name = (data.get('last_name') or '').strip()
    auth_method = (data.get('auth_method') or 'password').lower()
    password = data.get('password') or ''

    if not email or not first_name or not last_name:
        return jsonify({'error': 'Email, first name, and last name are required'}), 400

    if auth_method not in ['password', 'sso', 'email_auth']:
        return jsonify({'error': 'Invalid authentication method'}), 400

    if auth_method == 'password':
        if not password:
            return jsonify({'error': 'Password is required for password authentication'}), 400
        if len(password) < 8:
            return jsonify({'error': 'Password must be at least 8 characters'}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Email already exists'}), 409

    from backend.auth_utils import hash_password
    
    user = User(
        email=email,
        password_hash=hash_password(password) if password else None,
        first_name=first_name,
        last_name=last_name,
        role=UserRole.USER,
        is_active=True,
        is_verified=True,
        is_provisioned=True,
        auth_method=auth_method
    )
    db.session.add(user)
    db.session.flush()

    # Create membership
    membership = Membership(
        user_id=user.id,
        organization_id=org_id,
        role=MembershipRole.MEMBER
    )
    db.session.add(membership)
    db.session.commit()

    db.session.add(ActivityLog(
        user_id=g.current_user['sub'],
        organization_id=org_id,
        type=ActivityType.USER_CREATED,
        description=f'Org admin created user: {email}',
        metadata={'created_user_id': str(user.id), 'auth_method': auth_method},
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    ))
    db.session.commit()

    return jsonify({'user': user.to_dict(include_sensitive=True)}), 201


@org_admin_bp.put('/users/<user_id>')
@org_admin_bp.patch('/users/<user_id>')
@require_role('org_admin')
def org_admin_update_user(user_id):
    org_id = get_admin_organization_id()
    if not org_id:
        return jsonify({'error': 'Organization not found for admin'}), 404

    user = User.query.join(Membership).filter(
        Membership.organization_id == org_id,
        User.id == user_id
    ).first()

    if not user:
        return jsonify({'error': 'User not found in your organization'}), 404

    data = request.get_json(silent=True) or {}

    # Cannot change role, organization_id, or elevate privileges
    if 'role' in data:
        return jsonify({'error': 'Cannot change user role'}), 403

    if 'first_name' in data:
        user.first_name = (data['first_name'] or '').strip()
    if 'last_name' in data:
        user.last_name = (data['last_name'] or '').strip()
    if 'email' in data:
        new_email = (data['email'] or '').strip().lower()
        if new_email and new_email != user.email:
            if User.query.filter_by(email=new_email).first():
                return jsonify({'error': 'Email already exists'}), 409
            user.email = new_email
    if 'is_active' in data:
        user.is_active = bool(data['is_active'])
    if 'auth_method' in data:
        new_auth_method = (data['auth_method'] or '').lower()
        if new_auth_method not in ['password', 'sso', 'email_auth']:
            return jsonify({'error': 'Invalid authentication method'}), 400
        user.auth_method = new_auth_method
        if new_auth_method == 'password' and not user.password_hash:
            return jsonify({'error': 'Password must be set for password authentication'}), 400

    db.session.commit()

    db.session.add(ActivityLog(
        user_id=g.current_user['sub'],
        organization_id=org_id,
        type=ActivityType.ADMIN_USER_UPDATED,
        description=f'Org admin updated user: {user.email}',
        metadata={'updated_user_id': str(user.id)},
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    ))
    db.session.commit()

    return jsonify({'user': user.to_dict(include_sensitive=True)})


@org_admin_bp.post('/users/<user_id>/provision')
@require_role('org_admin')
def org_admin_provision_user(user_id):
    org_id = get_admin_organization_id()
    if not org_id:
        return jsonify({'error': 'Organization not found for admin'}), 404

    user = User.query.join(Membership).filter(
        Membership.organization_id == org_id,
        User.id == user_id
    ).first()

    if not user:
        return jsonify({'error': 'User not found in your organization'}), 404

    if user.is_provisioned:
        return jsonify({'message': 'User is already provisioned'}), 200

    user.is_provisioned = True
    user.is_active = True
    user.deprovisioned_at = None
    db.session.commit()

    db.session.add(ActivityLog(
        user_id=g.current_user['sub'],
        organization_id=org_id,
        type=ActivityType.USER_PROVISIONED,
        description=f'Org admin provisioned user: {user.email}',
        metadata={'provisioned_user_id': str(user.id)},
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    ))
    db.session.commit()

    return jsonify({'user': user.to_dict(include_sensitive=True)})


@org_admin_bp.post('/users/<user_id>/deprovision')
@require_role('org_admin')
def org_admin_deprovision_user(user_id):
    org_id = get_admin_organization_id()
    if not org_id:
        return jsonify({'error': 'Organization not found for admin'}), 404

    user = User.query.join(Membership).filter(
        Membership.organization_id == org_id,
        User.id == user_id
    ).first()

    if not user:
        return jsonify({'error': 'User not found in your organization'}), 404

    if not user.is_provisioned:
        return jsonify({'message': 'User is already deprovisioned'}), 200

    user.is_provisioned = False
    user.is_active = False
    from datetime import datetime
    user.deprovisioned_at = datetime.utcnow()
    db.session.commit()

    db.session.add(ActivityLog(
        user_id=g.current_user['sub'],
        organization_id=org_id,
        type=ActivityType.USER_DEPROVISIONED,
        description=f'Org admin deprovisioned user: {user.email}',
        metadata={'deprovisioned_user_id': str(user.id)},
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    ))
    db.session.commit()

    return jsonify({'user': user.to_dict(include_sensitive=True)})


@org_admin_bp.get('/provisioning')
@require_role('org_admin')
def org_admin_provisioning():
    org_id = get_admin_organization_id()
    if not org_id:
        return jsonify({'error': 'Organization not found for admin'}), 404

    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 50, type=int), 200)
    status_filter = request.args.get('status')  # provisioned, deprovisioned

    query = User.query.join(Membership).filter(
        Membership.organization_id == org_id,
        User.role == UserRole.USER
    )

    if status_filter == 'provisioned':
        query = query.filter(User.is_provisioned == True)
    elif status_filter == 'deprovisioned':
        query = query.filter(User.is_provisioned == False)

    pagination = query.order_by(User.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    return jsonify({
        'users': [u.to_dict(include_sensitive=True) for u in pagination.items],
        'pagination': {
            'page': pagination.page,
            'per_page': pagination.per_page,
            'total': pagination.total,
            'pages': pagination.pages
        }
    })


@org_admin_bp.post('/provisioning/bulk')
@require_role('org_admin')
def org_admin_bulk_provisioning():
    org_id = get_admin_organization_id()
    if not org_id:
        return jsonify({'error': 'Organization not found for admin'}), 404

    data = request.get_json(silent=True) or {}
    user_ids = data.get('user_ids', [])
    action = data.get('action')  # 'provision' or 'deprovision'

    if not user_ids or not isinstance(user_ids, list):
        return jsonify({'error': 'user_ids array required'}), 400

    if action not in ['provision', 'deprovision']:
        return jsonify({'error': 'Action must be "provision" or "deprovision"'}), 400

    # Verify all users belong to this organization
    users = User.query.join(Membership).filter(
        Membership.organization_id == org_id,
        User.id.in_(user_ids),
        User.role == UserRole.USER
    ).all()

    found_ids = {str(u.id) for u in users}
    missing_ids = [uid for uid in user_ids if uid not in found_ids]
    
    if missing_ids:
        return jsonify({'error': f'Users not found in your organization: {missing_ids}'}), 404

    from datetime import datetime
    for user in users:
        if action == 'provision':
            user.is_provisioned = True
            user.is_active = True
            user.deprovisioned_at = None
        else:
            user.is_provisioned = False
            user.is_active = False
            user.deprovisioned_at = datetime.utcnow()

    db.session.commit()

    activity_type = ActivityType.USER_PROVISIONED if action == 'provision' else ActivityType.USER_DEPROVISIONED
    description = f'Org admin bulk {action}ed {len(users)} users'

    db.session.add(ActivityLog(
        user_id=g.current_user['sub'],
        organization_id=org_id,
        type=activity_type,
        description=description,
        metadata={'user_ids': user_ids, 'bulk': True},
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    ))
    db.session.commit()

    return jsonify({'message': f'{len(users)} users {action}ed successfully'})


@org_admin_bp.get('/auth-config')
@require_role('org_admin')
def org_admin_get_auth_config():
    org_id = get_admin_organization_id()
    if not org_id:
        return jsonify({'error': 'Organization not found for admin'}), 404

    org = Organization.query.get(org_id)
    if not org:
        return jsonify({'error': 'Organization not found'}), 404

    # Get or create auth config
    auth_config = OrganizationAuthConfig.query.filter_by(organization_id=org_id).first()
    if not auth_config:
        auth_config = OrganizationAuthConfig(organization_id=org_id)
        db.session.add(auth_config)
        db.session.commit()

    return jsonify({'auth_config': auth_config.to_dict(include_sensitive=False)})


@org_admin_bp.put('/auth-config')
@require_role('org_admin')
def org_admin_update_auth_config():
    org_id = get_admin_organization_id()
    if not org_id:
        return jsonify({'error': 'Organization not found for admin'}), 404

    org = Organization.query.get(org_id)
    if not org:
        return jsonify({'error': 'Organization not found'}), 404

    data = request.get_json(silent=True) or {}

    auth_config = OrganizationAuthConfig.query.filter_by(organization_id=org_id).first()
    if not auth_config:
        auth_config = OrganizationAuthConfig(organization_id=org_id)
        db.session.add(auth_config)

    password_enabled = data.get('password_enabled', True)
    sso_enabled = data.get('sso_enabled', False)
    email_auth_enabled = data.get('email_auth_enabled', False)

    # Prevent disabling all authentication methods
    if not password_enabled and not sso_enabled and not email_auth_enabled:
        return jsonify({'error': 'At least one authentication method must be enabled'}), 400

    auth_config.password_enabled = password_enabled
    auth_config.sso_enabled = sso_enabled
    auth_config.email_auth_enabled = email_auth_enabled

    if 'sso_provider' in data:
        auth_config.sso_provider = data['sso_provider']
    if 'sso_client_id' in data:
        auth_config.sso_client_id = data['sso_client_id']
    if 'sso_client_secret' in data:
        auth_config.sso_client_secret = data['sso_client_secret']
    if 'sso_tenant_id' in data:
        auth_config.sso_tenant_id = data['sso_tenant_id']
    if 'sso_issuer' in data:
        auth_config.sso_issuer = data['sso_issuer']
    if 'sso_redirect_url' in data:
        auth_config.sso_redirect_url = data['sso_redirect_url']
    if 'sso_domain' in data:
        auth_config.sso_domain = data['sso_domain']
    if 'sso_metadata_url' in data:
        auth_config.sso_metadata_url = data['sso_metadata_url']
    if 'email_auth_domain' in data:
        auth_config.email_auth_domain = data['email_auth_domain']
    if 'email_auth_template' in data:
        auth_config.email_auth_template = data['email_auth_template']

    db.session.commit()

    db.session.add(ActivityLog(
        user_id=g.current_user['sub'],
        organization_id=org_id,
        type=ActivityType.AUTH_CONFIG_UPDATED,
        description='Org admin updated authentication configuration',
        metadata={
            'password_enabled': auth_config.password_enabled,
            'sso_enabled': auth_config.sso_enabled,
            'email_auth_enabled': auth_config.email_auth_enabled,
            'sso_provider': auth_config.sso_provider
        },
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    ))
    db.session.commit()

    return jsonify({'auth_config': auth_config.to_dict(include_sensitive=False)})


@org_admin_bp.get('/activity')
@require_role('org_admin')
def org_admin_activity():
    org_id = get_admin_organization_id()
    if not org_id:
        return jsonify({'error': 'Organization not found for admin'}), 404

    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 50, type=int), 200)
    search = request.args.get('search', '').strip()

    query = ActivityLog.query.filter_by(organization_id=org_id)

    if search:
        query = query.filter(
            or_(
                ActivityLog.description.ilike(f'%{search}%'),
                ActivityLog.type.ilike(f'%{search}%')
            )
        )

    pagination = query.order_by(ActivityLog.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    return jsonify({
        'activity': [a.to_dict() for a in pagination.items],
        'pagination': {
            'page': pagination.page,
            'per_page': pagination.per_page,
            'total': pagination.total,
            'pages': pagination.pages
        }
    })