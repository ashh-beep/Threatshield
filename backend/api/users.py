from flask import Blueprint, request, jsonify, g
from sqlalchemy import func

from backend.models import db, User, UserRole, Membership, MembershipRole, Organization, ActivityLog, ActivityType
from backend.auth_utils import require_auth, require_role, get_current_user

users_bp = Blueprint('users', __name__, url_prefix='/api/users')


@users_bp.get('')
@require_role('super_admin')
def list_users():
    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 20, type=int), 100)
    search = request.args.get('search', '').strip()
    role_filter = request.args.get('role')
    org_id = request.args.get('org_id')

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

    if org_id:
        query = query.join(Membership).filter(Membership.organization_id == org_id)

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


@users_bp.get('/<user_id>')
@require_auth
def get_user(user_id):
    current = get_current_user()
    if current['role'] != 'super_admin' and current['sub'] != user_id:
        return jsonify({'error': 'Access denied'}), 403

    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    return jsonify({'user': user.to_dict(include_sensitive=True)})


@users_bp.post('')
@require_role('super_admin')
def create_user():
    data = request.get_json(silent=True) or {}
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''
    first_name = (data.get('first_name') or '').strip()
    last_name = (data.get('last_name') or '').strip()
    role = data.get('role', 'user')

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
        is_verified=True
    )
    db.session.add(user)
    db.session.commit()

    org_id = data.get('organization_id')
    if org_id:
        org = Organization.query.get(org_id)
        if org:
            membership = Membership(user_id=user.id, organization_id=org.id, role=MembershipRole.MEMBER)
            db.session.add(membership)
            db.session.commit()

    db.session.add(ActivityLog(
        user_id=current['sub'],
        type=ActivityType.ADMIN_USER_CREATED,
        description=f'Created user: {email}',
        metadata={'created_user_id': str(user.id), 'role': role},
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    ))
    db.session.commit()

    return jsonify({'user': user.to_dict(include_sensitive=True)}), 201


@users_bp.patch('/<user_id>')
@require_auth
def update_user(user_id):
    current = get_current_user()
    if current['role'] != 'super_admin' and current['sub'] != user_id:
        return jsonify({'error': 'Access denied'}), 403

    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    data = request.get_json(silent=True) or {}

    if current['role'] == 'super_admin':
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
        user_id=current['sub'],
        type=ActivityType.ADMIN_USER_UPDATED if current['role'] == 'super_admin' else ActivityType.USER_PASSWORD_RESET,
        description=f'Updated user: {user.email}',
        metadata={'updated_user_id': str(user.id)},
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    ))
    db.session.commit()

    return jsonify({'user': user.to_dict(include_sensitive=True)})


@users_bp.delete('/<user_id>')
@require_role('super_admin')
def delete_user(user_id):
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    email = user.email
    db.session.delete(user)
    db.session.commit()

    db.session.add(ActivityLog(
        user_id=g.current_user['sub'],
        type=ActivityType.ADMIN_USER_DELETED,
        description=f'Deleted user: {email}',
        metadata={'deleted_user_id': user_id},
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    ))
    db.session.commit()

    return jsonify({'message': 'User deleted'})


@users_bp.get('/<user_id>/memberships')
@require_auth
def get_user_memberships(user_id):
    current = get_current_user()
    if current['role'] != 'super_admin' and current['sub'] != user_id:
        return jsonify({'error': 'Access denied'}), 403

    memberships = Membership.query.filter_by(user_id=user_id).all()
    return jsonify({'memberships': [m.to_dict() for m in memberships]})


@users_bp.get('/<user_id>/scans')
@require_auth
def get_user_scans(user_id):
    current = get_current_user()
    if current['role'] != 'super_admin' and current['sub'] != user_id:
        return jsonify({'error': 'Access denied'}), 403

    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 20, type=int), 100)

    from backend.models import Scan
    pagination = Scan.query.filter_by(user_id=user_id).order_by(Scan.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    return jsonify({
        'scans': [s.to_dict() for s in pagination.items],
        'pagination': {
            'page': pagination.page,
            'per_page': pagination.per_page,
            'total': pagination.total,
            'pages': pagination.pages
        }
    })