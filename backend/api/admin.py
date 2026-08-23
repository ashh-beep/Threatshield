from flask import Blueprint, request, jsonify, g
from sqlalchemy import func

from backend.models import db, User, UserRole, Organization, OrganizationStatus, Membership, MembershipRole, Scan, ScanVerdict, ActivityLog, ActivityType
from backend.auth_utils import require_auth, require_role, get_current_user

admin_bp = Blueprint('admin', __name__, url_prefix='/api/admin')


@admin_bp.get('/dashboard')
@require_role('super_admin')
def admin_dashboard():
    total_users = User.query.count()
    active_users = User.query.filter_by(is_active=True).count()
    total_orgs = Organization.query.count()
    active_orgs = Organization.query.filter_by(status=OrganizationStatus.ACTIVE).count()
    total_scans = Scan.query.count()

    recent_users = User.query.order_by(User.created_at.desc()).limit(5).all()
    recent_orgs = Organization.query.order_by(Organization.created_at.desc()).limit(5).all()
    recent_scans = Scan.query.order_by(Scan.created_at.desc()).limit(10).all()

    verdict_stats = db.session.query(Scan.verdict, func.count(Scan.id)).group_by(Scan.verdict).all()
    verdict_counts = {v.value: c for v, c in verdict_stats}

    org_status_stats = db.session.query(Organization.status, func.count(Organization.id)).group_by(Organization.status).all()
    org_status_counts = {s.value: c for s, c in org_status_stats}

    return jsonify({
        'users': {'total': total_users, 'active': active_users},
        'organizations': {'total': total_orgs, 'active': active_orgs},
        'scans': {'total': total_scans, 'by_verdict': verdict_counts},
        'organizations_by_status': org_status_counts,
        'recent_users': [u.to_dict() for u in recent_users],
        'recent_organizations': [o.to_dict() for o in recent_orgs],
        'recent_scans': [s.to_dict() for s in recent_scans]
    })


@admin_bp.get('/users')
@require_role('super_admin')
def admin_list_users():
    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 50, type=int), 100)
    search = request.args.get('search', '').strip()
    role_filter = request.args.get('role')
    is_active = request.args.get('is_active')

    query = User.query
    if search:
        query = query.filter(
            (User.email.ilike(f'%{search}%')) |
            (User.first_name.ilike(f'%{search}%')) |
            (User.last_name.ilike(f'%{search}%'))
        )
    if role_filter:
        try:
            query = query.filter(User.role == UserRole(role_filter))
        except ValueError:
            pass
    if is_active is not None:
        query = query.filter(User.is_active == (is_active.lower() == 'true'))

    pagination = query.order_by(User.created_at.desc()).paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        'users': [u.to_dict(include_sensitive=True) for u in pagination.items],
        'pagination': {
            'page': pagination.page,
            'per_page': pagination.per_page,
            'total': pagination.total,
            'pages': pagination.pages
        }
    })


@admin_bp.post('/users')
@require_role('super_admin')
def admin_create_user():
    data = request.get_json(silent=True) or {}
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''
    first_name = (data.get('first_name') or '').strip()
    last_name = (data.get('last_name') or '').strip()
    role = data.get('role', 'user')
    is_active = data.get('is_active', True)
    is_verified = data.get('is_verified', True)

    if not email or not password or not first_name or not last_name:
        return jsonify({'error': 'All fields required'}), 400

    if len(password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters'}), 400

    try:
        user_role = UserRole(role)
    except ValueError:
        return jsonify({'error': 'Invalid role'}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Email already exists'}), 409

    from backend.auth_utils import hash_password
    user = User(
        email=email,
        password_hash=hash_password(password),
        first_name=first_name,
        last_name=last_name,
        role=user_role,
        is_active=is_active,
        is_verified=is_verified
    )
    db.session.add(user)
    db.session.commit()

    org_id = data.get('organization_id')
    if org_id:
        org = Organization.query.get(org_id)
        if org:
            membership = Membership(user_id=user.id, organization_id=org.id, role=MembershipRole.ADMIN)
            db.session.add(membership)
            db.session.commit()

    db.session.add(ActivityLog(
        user_id=g.current_user['sub'],
        type=ActivityType.ADMIN_USER_CREATED,
        description=f'Admin created user: {email}',
        metadata={'created_user_id': str(user.id), 'role': role},
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    ))
    db.session.commit()

    return jsonify({'user': user.to_dict(include_sensitive=True)}), 201


@admin_bp.patch('/users/<user_id>')
@require_role('super_admin')
def admin_update_user(user_id):
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    data = request.get_json(silent=True) or {}

    if 'role' in data:
        try:
            user.role = UserRole(data['role'])
        except ValueError:
            return jsonify({'error': 'Invalid role'}), 400
    if 'is_active' in data:
        user.is_active = data['is_active']
    if 'is_verified' in data:
        user.is_verified = data['is_verified']
    if 'first_name' in data:
        user.first_name = (data['first_name'] or '').strip()
    if 'last_name' in data:
        user.last_name = (data['last_name'] or '').strip()

    db.session.commit()

    db.session.add(ActivityLog(
        user_id=g.current_user['sub'],
        type=ActivityType.ADMIN_USER_UPDATED,
        description=f'Admin updated user: {user.email}',
        metadata={'updated_user_id': str(user.id)},
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    ))
    db.session.commit()

    return jsonify({'user': user.to_dict(include_sensitive=True)})


@admin_bp.delete('/users/<user_id>')
@require_role('super_admin')
def admin_delete_user(user_id):
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    email = user.email
    db.session.delete(user)
    db.session.commit()

    db.session.add(ActivityLog(
        user_id=g.current_user['sub'],
        type=ActivityType.ADMIN_USER_DELETED,
        description=f'Admin deleted user: {email}',
        metadata={'deleted_user_id': user_id},
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    ))
    db.session.commit()

    return jsonify({'message': 'User deleted'})


@admin_bp.get('/organizations')
@require_role('super_admin')
def admin_list_organizations():
    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 50, type=int), 100)
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

    pagination = query.order_by(Organization.created_at.desc()).paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        'organizations': [o.to_dict(include_sensitive=True) for o in pagination.items],
        'pagination': {
            'page': pagination.page,
            'per_page': pagination.per_page,
            'total': pagination.total,
            'pages': pagination.pages
        }
    })


@admin_bp.post('/organizations')
@require_role('super_admin')
def admin_create_organization():
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
        type=ActivityType.ADMIN_ORG_CREATED,
        description=f'Admin created organization: {name}',
        metadata={'org_id': str(org.id)},
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    ))
    db.session.commit()

    return jsonify({'organization': org.to_dict(include_sensitive=True)}), 201


@admin_bp.patch('/organizations/<org_id>')
@require_role('super_admin')
def admin_update_organization(org_id):
    org = Organization.query.get(org_id)
    if not org:
        return jsonify({'error': 'Organization not found'}), 404

    data = request.get_json(silent=True) or {}

    if 'name' in data:
        org.name = (data['name'] or '').strip()
    if 'domain' in data:
        domain = (data['domain'] or '').strip().lower() or None
        if domain and domain != org.domain:
            if Organization.query.filter_by(domain=domain).first():
                return jsonify({'error': 'Domain already exists'}), 409
            org.domain = domain
    if 'status' in data:
        try:
            org.status = OrganizationStatus(data['status'])
        except ValueError:
            return jsonify({'error': 'Invalid status'}), 400
    if 'settings' in data:
        org.settings = {**org.settings, **data['settings']}

    db.session.commit()

    db.session.add(ActivityLog(
        user_id=g.current_user['sub'],
        organization_id=org.id,
        type=ActivityType.ADMIN_ORG_UPDATED,
        description=f'Admin updated organization: {org.name}',
        metadata={'org_id': str(org.id)},
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    ))
    db.session.commit()

    return jsonify({'organization': org.to_dict(include_sensitive=True)})


@admin_bp.patch('/organizations/<org_id>/license')
@require_role('super_admin')
def admin_update_organization_license(org_id):
    org = Organization.query.get(org_id)
    if not org:
        return jsonify({'error': 'Organization not found'}), 404

    data = request.get_json(silent=True) or {}

    if 'plan_name' in data:
        if data['plan_name'] not in ['starter', 'business', 'enterprise', None, '']:
            return jsonify({'error': 'Invalid plan name'}), 400
        org.plan_name = data['plan_name'] or None

    if 'plan_status' in data:
        if data['plan_status'] not in ['active', 'suspended', 'expired']:
            return jsonify({'error': 'Invalid plan status'}), 400
        old_status = org.plan_status
        org.plan_status = data['plan_status']
        if old_status != org.plan_status:
            db.session.add(ActivityLog(
                user_id=g.current_user['sub'],
                organization_id=org.id,
                type=ActivityType.LICENSE_SUSPENDED if org.plan_status == 'suspended' else ActivityType.LICENSE_REACTIVATED,
                description=f'License {org.plan_status}',
                metadata={'org_id': str(org.id), 'old_status': old_status, 'new_status': org.plan_status},
                ip_address=request.remote_addr,
                user_agent=request.headers.get('User-Agent')
            ))

    if 'max_users' in data:
        try:
            max_users = int(data['max_users'])
            if max_users < 1:
                return jsonify({'error': 'Max users must be at least 1'}), 400
            org.max_users = max_users
        except (ValueError, TypeError):
            return jsonify({'error': 'Invalid max_users value'}), 400

    if 'scans_per_month' in data:
        try:
            org.scans_per_month = int(data['scans_per_month'])
        except (ValueError, TypeError):
            return jsonify({'error': 'Invalid scans_per_month value'}), 400

    if 'monthly_scan_limit' in data:
        try:
            org.monthly_scan_limit = int(data['monthly_scan_limit'])
        except (ValueError, TypeError):
            return jsonify({'error': 'Invalid monthly_scan_limit value'}), 400

    if 'license_expiry' in data:
        if data['license_expiry']:
            try:
                org.license_expiry = datetime.fromisoformat(data['license_expiry'].replace('Z', '+00:00'))
            except (ValueError, TypeError):
                return jsonify({'error': 'Invalid license_expiry format. Use ISO 8601.'}), 400
        else:
            org.license_expiry = None

    db.session.commit()

    db.session.add(ActivityLog(
        user_id=g.current_user['sub'],
        organization_id=org.id,
        type=ActivityType.LICENSE_UPDATED,
        description=f'Admin updated license for organization: {org.name}',
        metadata={'org_id': str(org.id), 'changes': data},
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    ))
    db.session.commit()

    return jsonify({'organization': org.to_dict(include_sensitive=True)})


@admin_bp.delete('/organizations/<org_id>')
@require_role('super_admin')
def admin_delete_organization(org_id):
    org = Organization.query.get(org_id)
    if not org:
        return jsonify({'error': 'Organization not found'}), 404

    name = org.name
    db.session.delete(org)
    db.session.commit()

    db.session.add(ActivityLog(
        user_id=g.current_user['sub'],
        type=ActivityType.ADMIN_ORG_DELETED,
        description=f'Admin deleted organization: {name}',
        metadata={'org_id': org_id},
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    ))
    db.session.commit()

    return jsonify({'message': 'Organization deleted'})


@admin_bp.get('/activity')
@require_role('super_admin')
def admin_activity():
    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 100, type=int), 200)
    user_id = request.args.get('user_id')
    org_id = request.args.get('org_id')
    type_filter = request.args.get('type')

    query = ActivityLog.query
    if user_id:
        query = query.filter(ActivityLog.user_id == user_id)
    if org_id:
        query = query.filter(ActivityLog.organization_id == org_id)
    if type_filter:
        try:
            query = query.filter(ActivityLog.type == ActivityType(type_filter))
        except ValueError:
            pass

    pagination = query.order_by(ActivityLog.created_at.desc()).paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        'activity': [a.to_dict() for a in pagination.items],
        'pagination': {
            'page': pagination.page,
            'per_page': pagination.per_page,
            'total': pagination.total,
            'pages': pagination.pages
        }
    })


@admin_bp.get('/stats')
@require_role('super_admin')
def admin_stats():
    total_users = User.query.count()
    total_orgs = Organization.query.count()
    total_scans = Scan.query.count()
    total_memberships = Membership.query.count()

    users_by_role = db.session.query(User.role, func.count(User.id)).group_by(User.role).all()
    orgs_by_status = db.session.query(Organization.status, func.count(Organization.id)).group_by(Organization.status).all()
    scans_by_verdict = db.session.query(Scan.verdict, func.count(Scan.id)).group_by(Scan.verdict).all()

    return jsonify({
        'totals': {
            'users': total_users,
            'organizations': total_orgs,
            'scans': total_scans,
            'memberships': total_memberships
        },
        'users_by_role': {r.value: c for r, c in users_by_role},
        'organizations_by_status': {s.value: c for s, c in orgs_by_status},
        'scans_by_verdict': {v.value: c for v, c in scans_by_verdict}
    })