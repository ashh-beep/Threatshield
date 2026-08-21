from datetime import datetime, timedelta
from functools import wraps
import jwt
from flask import request, jsonify, current_app, g
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
import secrets

ph = PasswordHasher()


def hash_password(password: str) -> str:
    return ph.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        ph.verify(password_hash, password)
        return True
    except VerifyMismatchError:
        return False
    except Exception:
        return False


def generate_access_token(user_id: str, role: str, org_id: str = None) -> str:
    # For org_admin, get org_id from membership if not provided
    if role == 'org_admin' and not org_id:
        from backend.models import Membership
        membership = Membership.query.filter_by(user_id=user_id).first()
        if membership:
            org_id = str(membership.organization_id)
    
    payload = {
        'sub': user_id,
        'role': role,
        'org_id': org_id,
        'type': 'access',
        'exp': datetime.utcnow() + current_app.config['JWT_ACCESS_TOKEN_EXPIRES'],
        'iat': datetime.utcnow(),
        'jti': secrets.token_urlsafe(16)
    }
    return jwt.encode(payload, current_app.config['JWT_SECRET_KEY'], algorithm='HS256')


def generate_refresh_token(user_id: str) -> str:
    payload = {
        'sub': user_id,
        'type': 'refresh',
        'exp': datetime.utcnow() + current_app.config['JWT_REFRESH_TOKEN_EXPIRES'],
        'iat': datetime.utcnow(),
        'jti': secrets.token_urlsafe(16)
    }
    return jwt.encode(payload, current_app.config['JWT_SECRET_KEY'], algorithm='HS256')


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, current_app.config['JWT_SECRET_KEY'], algorithms=['HS256'])
    except jwt.ExpiredSignatureError:
        raise ValueError('Token has expired')
    except jwt.InvalidTokenError:
        raise ValueError('Invalid token')


def get_token_from_header() -> str:
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        return None
    parts = auth_header.split()
    if len(parts) != 2 or parts[0].lower() != 'bearer':
        return None
    return parts[1]


def get_current_user() -> dict:
    token = get_token_from_header()
    if not token:
        return None
    try:
        payload = decode_token(token)
        if payload.get('type') != 'access':
            return None
        return payload
    except ValueError:
        return None


def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({'error': 'Authentication required'}), 401
        g.current_user = user
        return f(*args, **kwargs)
    return decorated


def require_role(*allowed_roles):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            user = get_current_user()
            if not user:
                return jsonify({'error': 'Authentication required'}), 401
            if user.get('role') not in allowed_roles:
                return jsonify({'error': 'Insufficient permissions'}), 403
            g.current_user = user
            return f(*args, **kwargs)
        return decorated
    return decorator


def require_org_access(org_id_param='org_id'):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            user = get_current_user()
            if not user:
                return jsonify({'error': 'Authentication required'}), 401

            org_id = kwargs.get(org_id_param) or request.view_args.get(org_id_param)
            if not org_id:
                return jsonify({'error': 'Organization ID required'}), 400

            user_org_id = user.get('org_id')
            user_role = user.get('role')

            if user_role == 'super_admin':
                g.current_user = user
                return f(*args, **kwargs)

            if user_org_id != org_id:
                return jsonify({'error': 'Access denied to this organization'}), 403

            g.current_user = user
            return f(*args, **kwargs)
        return decorated
    return decorator


def optional_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        user = get_current_user()
        g.current_user = user
        return f(*args, **kwargs)
    return decorated