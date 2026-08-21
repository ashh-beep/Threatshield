from flask import Blueprint, request, jsonify, g
from sqlalchemy import func

from backend.models import db, Organization, OrganizationStatus, Membership, MembershipRole, User, UserRole, Scan, ScanVerdict, ActivityLog, ActivityType
from backend.auth_utils import require_auth, require_role, require_org_access, get_current_user

orgs_bp = Blueprint('organizations', __name__, url_prefix='/api/organizations')


@orgs_bp.get('')
@require_auth
def list_organizations():
    current = get_current_user()

    if current['role'] == 'super_admin':
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 20, type=int), 100)
        search = request.args.get('search', '').strip()
        status_filter = request.args.get('status')

        query = Organization.query
        if search:
            query = query.filter(Organization.name.ilike(f'%{search}%'))
        if status_filter:
            try:
                query = query.filter(Organization.status == OrganizationStatus(status_filter))
            except ValueError:
                pass

        pagination = query.order_by(Organization.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        return jsonify({
            'organizations': [o.to_dict(include_sensitive=True) for o in pagination.items],
            'pagination': {
                'page': pagination.page,
                'per_page': pagination.per_page,
                'total': pagination.total,
                'pages': pagination.pages
            }
        })

    memberships = Membership.query.filter_by(user_id=current['sub']).all()
    orgs = [m.organization for m in memberships]
    return jsonify({'organizations': [o.to_dict() for o in orgs]})


@orgs_bp.get('/<org_id>')
@require_org_access()
def get_organization(org_id):
    org = Organization.query.get(org_id)
    if not org:
        return jsonify({'error': 'Organization not found'}), 404

    current = get_current_user()
    include_sensitive = current['role'] == 'super_admin' or current.get('org_id') == org_id
    return jsonify({'organization': org.to_dict(include_sensitive=include_sensitive)})


@orgs_bp.post('')
@require_role('super_admin')
def create_organization():
    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    slug = (data.get('slug') or '').strip().lower()
    domain = (data.get('domain') or '').strip().lower() or None

    if not name or not slug:
        return jsonify({'error': 'Name and slug required'}), 400

    if Organization.query.filter_by(slug=slug).first():
        return jsonify({'error': 'Slug already exists'}), 409
    if domain and Organization.query.filter_by(domain=domain).first():
        return jsonify({'error': 'Domain already exists'}), 409

    org = Organization(name=name, slug=slug, domain=domain)
    db.session.add(org)
    db.session.commit()

    admin_id = data.get('admin_id')
    if admin_id:
        user = User.query.get(admin_id)
        if user:
            membership = Membership(user_id=user.id, organization_id=org.id, role=MembershipRole.ADMIN)
            db.session.add(membership)
            user.role = UserRole.ORG_ADMIN
            db.session.commit()

    db.session.add(ActivityLog(
        user_id=g.current_user['sub'],
        organization_id=org.id,
        type=ActivityType.ADMIN_ORG_CREATED,
        description=f'Created organization: {name}',
        metadata={'org_id': str(org.id)},
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    ))
    db.session.commit()

    return jsonify({'organization': org.to_dict(include_sensitive=True)}), 201


@orgs_bp.patch('/<org_id>')
@require_org_access()
def update_organization(org_id):
    org = Organization.query.get(org_id)
    if not org:
        return jsonify({'error': 'Organization not found'}), 404

    current = get_current_user()
    is_super = current['role'] == 'super_admin'
    membership = Membership.query.filter_by(user_id=current['sub'], organization_id=org_id).first()
    is_owner = membership and membership.role == MembershipRole.OWNER
    is_admin = membership and membership.role == MembershipRole.ADMIN

    if not (is_super or is_owner or is_admin):
        return jsonify({'error': 'Insufficient permissions'}), 403

    data = request.get_json(silent=True) or {}

    if 'name' in data:
        org.name = (data['name'] or '').strip()
    if 'domain' in data:
        domain = (data['domain'] or '').strip().lower() or None
        if domain and domain != org.domain:
            if Organization.query.filter_by(domain=domain).first():
                return jsonify({'error': 'Domain already exists'}), 409
            org.domain = domain
    if 'status' in data and is_super:
        try:
            org.status = OrganizationStatus(data['status'])
        except ValueError:
            return jsonify({'error': 'Invalid status'}), 400
    if 'settings' in data and (is_super or is_owner or is_admin):
        org.settings = {**org.settings, **data['settings']}

    db.session.commit()

    db.session.add(ActivityLog(
        user_id=current['sub'],
        organization_id=org.id,
        type=ActivityType.ORG_UPDATED if not is_super else ActivityType.ADMIN_ORG_UPDATED,
        description=f'Updated organization: {org.name}',
        metadata={'org_id': str(org.id)},
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    ))
    db.session.commit()

    return jsonify({'organization': org.to_dict(include_sensitive=is_super or current.get('org_id') == org_id)})


@orgs_bp.delete('/<org_id>')
@require_role('super_admin')
def delete_organization(org_id):
    org = Organization.query.get(org_id)
    if not org:
        return jsonify({'error': 'Organization not found'}), 404

    name = org.name
    db.session.delete(org)
    db.session.commit()

    db.session.add(ActivityLog(
        user_id=g.current_user['sub'],
        type=ActivityType.ADMIN_ORG_DELETED,
        description=f'Deleted organization: {name}',
        metadata={'org_id': org_id},
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    ))
    db.session.commit()

    return jsonify({'message': 'Organization deleted'})


@orgs_bp.get('/<org_id>/members')
@require_org_access()
def list_members(org_id):
    memberships = Membership.query.filter_by(organization_id=org_id).all()
    return jsonify({'members': [m.to_dict() for m in memberships]})


@orgs_bp.post('/<org_id>/members')
@require_org_access()
def add_member(org_id):
    current = get_current_user()
    membership = Membership.query.filter_by(user_id=current['sub'], organization_id=org_id).first()
    is_super = current['role'] == 'super_admin'
    is_owner = membership and membership.role == MembershipRole.OWNER
    is_admin = membership and membership.role == MembershipRole.ADMIN

    if not (is_super or is_owner or is_admin):
        return jsonify({'error': 'Insufficient permissions'}), 403

    data = request.get_json(silent=True) or {}
    email = (data.get('email') or '').strip().lower()
    role = data.get('role', 'member')

    if not email:
        return jsonify({'error': 'Email required'}), 400

    try:
        membership_role = MembershipRole(role)
    except ValueError:
        return jsonify({'error': 'Invalid role'}), 400

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({'error': 'User not found'}), 404

    existing = Membership.query.filter_by(user_id=user.id, organization_id=org_id).first()
    if existing:
        return jsonify({'error': 'User already a member'}), 409

    new_membership = Membership(user_id=user.id, organization_id=org_id, role=membership_role)
    db.session.add(new_membership)

    if user.role == UserRole.USER:
        user.role = UserRole.ORG_ADMIN
    db.session.commit()

    db.session.add(ActivityLog(
        user_id=current['sub'],
        organization_id=org_id,
        type=ActivityType.ORG_MEMBER_ADDED,
        description=f'Added member {email} as {role}',
        metadata={'member_id': str(user.id), 'role': role},
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    ))
    db.session.commit()

    return jsonify({'membership': new_membership.to_dict()}), 201


@orgs_bp.patch('/<org_id>/members/<user_id>')
@require_org_access()
def update_member(org_id, user_id):
    current = get_current_user()
    membership = Membership.query.filter_by(user_id=current['sub'], organization_id=org_id).first()
    is_super = current['role'] == 'super_admin'
    is_owner = membership and membership.role == MembershipRole.OWNER
    is_admin = membership and membership.role == MembershipRole.ADMIN

    target_membership = Membership.query.filter_by(user_id=user_id, organization_id=org_id).first()
    if not target_membership:
        return jsonify({'error': 'Member not found'}), 404

    if target_membership.role == MembershipRole.OWNER and not is_super:
        return jsonify({'error': 'Cannot modify owner'}), 403

    if not (is_super or is_owner or (is_admin and target_membership.role != MembershipRole.ADMIN)):
        return jsonify({'error': 'Insufficient permissions'}), 403

    data = request.get_json(silent=True) or {}
    if 'role' in data:
        try:
            target_membership.role = MembershipRole(data['role'])
        except ValueError:
            return jsonify({'error': 'Invalid role'}), 400

    db.session.commit()

    db.session.add(ActivityLog(
        user_id=current['sub'],
        organization_id=org_id,
        type=ActivityType.ORG_MEMBER_ROLE_CHANGED,
        description=f'Changed member role to {target_membership.role.value}',
        metadata={'member_id': user_id, 'new_role': target_membership.role.value},
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    ))
    db.session.commit()

    return jsonify({'membership': target_membership.to_dict()})


@orgs_bp.delete('/<org_id>/members/<user_id>')
@require_org_access()
def remove_member(org_id, user_id):
    current = get_current_user()
    membership = Membership.query.filter_by(user_id=current['sub'], organization_id=org_id).first()
    is_super = current['role'] == 'super_admin'
    is_owner = membership and membership.role == MembershipRole.OWNER
    is_admin = membership and membership.role == MembershipRole.ADMIN

    target_membership = Membership.query.filter_by(user_id=user_id, organization_id=org_id).first()
    if not target_membership:
        return jsonify({'error': 'Member not found'}), 404

    if target_membership.role == MembershipRole.OWNER and not is_super:
        return jsonify({'error': 'Cannot remove owner'}), 403

    if not (is_super or is_owner or (is_admin and target_membership.role != MembershipRole.ADMIN)):
        return jsonify({'error': 'Insufficient permissions'}), 403

    user_email = target_membership.user.email if target_membership.user else user_id
    db.session.delete(target_membership)

    user = User.query.get(user_id)
    if user and not Membership.query.filter_by(user_id=user_id).first():
        user.role = UserRole.USER

    db.session.commit()

    db.session.add(ActivityLog(
        user_id=current['sub'],
        organization_id=org_id,
        type=ActivityType.ORG_MEMBER_REMOVED,
        description=f'Removed member {user_email}',
        metadata={'member_id': user_id},
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    ))
    db.session.commit()

    return jsonify({'message': 'Member removed'})


@orgs_bp.post('/<org_id>/members/<user_id>/deprovision')
@require_org_access()
def deprovision_member(org_id, user_id):
    current = get_current_user()
    membership = Membership.query.filter_by(user_id=current['sub'], organization_id=org_id).first()
    is_super = current['role'] == 'super_admin'
    is_owner = membership and membership.role == MembershipRole.OWNER
    is_admin = membership and membership.role == MembershipRole.ADMIN

    target_membership = Membership.query.filter_by(user_id=user_id, organization_id=org_id).first()
    if not target_membership:
        return jsonify({'error': 'Member not found'}), 404

    if target_membership.role == MembershipRole.OWNER and not is_super:
        return jsonify({'error': 'Cannot deprovision owner'}), 403

    if not (is_super or is_owner or (is_admin and target_membership.role != MembershipRole.ADMIN)):
        return jsonify({'error': 'Insufficient permissions'}), 403

    user_email = target_membership.user.email if target_membership.user else user_id
    db.session.delete(target_membership)

    user = User.query.get(user_id)
    if user:
        user.role = UserRole.USER
        user.is_active = False

    db.session.commit()

    db.session.add(ActivityLog(
        user_id=current['sub'],
        organization_id=org_id,
        type=ActivityType.ORG_MEMBER_REMOVED,
        description=f'Deprovisioned member {user_email}',
        metadata={'member_id': user_id, 'deprovisioned': True},
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    ))
    db.session.commit()

    return jsonify({'message': 'Member deprovisioned and login disabled'})


@orgs_bp.get('/<org_id>/settings')
@require_org_access()
def get_settings(org_id):
    org = Organization.query.get(org_id)
    if not org:
        return jsonify({'error': 'Organization not found'}), 404
    return jsonify({'settings': org.settings})


@orgs_bp.patch('/<org_id>/settings')
@require_org_access()
def update_settings(org_id):
    current = get_current_user()
    membership = Membership.query.filter_by(user_id=current['sub'], organization_id=org_id).first()
    is_super = current['role'] == 'super_admin'
    is_owner = membership and membership.role == MembershipRole.OWNER
    is_admin = membership and membership.role == MembershipRole.ADMIN

    if not (is_super or is_owner or is_admin):
        return jsonify({'error': 'Insufficient permissions'}), 403

    org = Organization.query.get(org_id)
    if not org:
        return jsonify({'error': 'Organization not found'}), 404

    data = request.get_json(silent=True) or {}
    org.settings = {**org.settings, **data}
    db.session.commit()

    db.session.add(ActivityLog(
        user_id=current['sub'],
        organization_id=org_id,
        type=ActivityType.ORG_SETTINGS_UPDATED,
        description='Updated organization settings',
        metadata={'settings': org.settings},
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    ))
    db.session.commit()

    return jsonify({'settings': org.settings})


@orgs_bp.get('/<org_id>/sso')
@require_org_access()
def get_sso_config(org_id):
    org = Organization.query.get(org_id)
    if not org:
        return jsonify({'error': 'Organization not found'}), 404

    current = get_current_user()
    is_super = current['role'] == 'super_admin'
    membership = Membership.query.filter_by(user_id=current['sub'], organization_id=org_id).first()
    is_owner = membership and membership.role == MembershipRole.OWNER

    if not (is_super or is_owner):
        return jsonify({'error': 'Insufficient permissions'}), 403

    sso_config = {k: v for k, v in org.sso_config.items() if k != 'client_secret'}
    return jsonify({'sso_config': sso_config, 'configured': bool(org.sso_config.get('client_id'))})


@orgs_bp.put('/<org_id>/sso')
@require_org_access()
def configure_sso(org_id):
    current = get_current_user()
    membership = Membership.query.filter_by(user_id=current['sub'], organization_id=org_id).first()
    is_super = current['role'] == 'super_admin'
    is_owner = membership and membership.role == MembershipRole.OWNER

    if not (is_super or is_owner):
        return jsonify({'error': 'Insufficient permissions'}), 403

    org = Organization.query.get(org_id)
    if not org:
        return jsonify({'error': 'Organization not found'}), 404

    data = request.get_json(silent=True) or {}
    client_id = (data.get('client_id') or '').strip()
    client_secret = (data.get('client_secret') or '').strip()
    tenant_id = (data.get('tenant_id') or 'common').strip()
    enabled = data.get('enabled', True)

    if not client_id or not client_secret:
        return jsonify({'error': 'Client ID and secret required'}), 400

    org.sso_config = {
        'client_id': client_id,
        'client_secret': client_secret,
        'tenant_id': tenant_id,
        'enabled': enabled
    }
    db.session.commit()

    db.session.add(ActivityLog(
        user_id=current['sub'],
        organization_id=org_id,
        type=ActivityType.ORG_SSO_CONFIGURED,
        description='Configured Microsoft Entra ID SSO',
        metadata={'enabled': enabled},
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    ))
    db.session.commit()

    return jsonify({'sso_config': {k: v for k, v in org.sso_config.items() if k != 'client_secret'}, 'configured': True})


@orgs_bp.delete('/<org_id>/sso')
@require_org_access()
def disable_sso(org_id):
    current = get_current_user()
    membership = Membership.query.filter_by(user_id=current['sub'], organization_id=org_id).first()
    is_super = current['role'] == 'super_admin'
    is_owner = membership and membership.role == MembershipRole.OWNER

    if not (is_super or is_owner):
        return jsonify({'error': 'Insufficient permissions'}), 403

    org = Organization.query.get(org_id)
    if not org:
        return jsonify({'error': 'Organization not found'}), 404

    org.sso_config = {}
    db.session.commit()

    db.session.add(ActivityLog(
        user_id=current['sub'],
        organization_id=org_id,
        type=ActivityType.ORG_SSO_CONFIGURED,
        description='Disabled SSO',
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    ))
    db.session.commit()

    return jsonify({'message': 'SSO disabled', 'configured': False})


@orgs_bp.get('/<org_id>/activity')
@require_org_access()
def get_org_activity(org_id):
    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 50, type=int), 100)

    pagination = ActivityLog.query.filter_by(organization_id=org_id).order_by(
        ActivityLog.created_at.desc()
    ).paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        'activity': [a.to_dict() for a in pagination.items],
        'pagination': {
            'page': pagination.page,
            'per_page': pagination.per_page,
            'total': pagination.total,
            'pages': pagination.pages
        }
    })


@orgs_bp.get('/<org_id>/stats')
@require_org_access()
def get_org_stats(org_id):
    org = Organization.query.get(org_id)
    if not org:
        return jsonify({'error': 'Organization not found'}), 404

    total_scans = Scan.query.filter_by(organization_id=org_id).count()
    dangerous_scans = Scan.query.filter_by(organization_id=org_id, verdict=ScanVerdict.DANGEROUS).count()
    suspicious_scans = Scan.query.filter_by(organization_id=org_id, verdict=ScanVerdict.SUSPICIOUS).count()
    safe_scans = Scan.query.filter_by(organization_id=org_id, verdict=ScanVerdict.SAFE).count()

    member_count = Membership.query.filter_by(organization_id=org_id).count()
    admin_count = Membership.query.filter_by(organization_id=org_id, role=MembershipRole.ADMIN).count()

    recent_scans = Scan.query.filter_by(organization_id=org_id).order_by(Scan.created_at.desc()).limit(5).all()

    return jsonify({
        'scans': {
            'total': total_scans,
            'dangerous': dangerous_scans,
            'suspicious': suspicious_scans,
            'safe': safe_scans
        },
        'members': {
            'total': member_count,
            'admins': admin_count
        },
        'recent_scans': [s.to_dict() for s in recent_scans]
    })