from datetime import datetime
from enum import Enum
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import Enum as SQLEnum, String, TypeDecorator, CHAR
from sqlalchemy.dialects.postgresql import UUID
import uuid


class GUID(TypeDecorator):
    """Platform-independent GUID type.
    Uses PostgreSQL's UUID type, otherwise uses CHAR(36) for SQLite/other databases.
    """
    impl = CHAR
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == 'postgresql':
            return dialect.type_descriptor(UUID())
        else:
            return dialect.type_descriptor(CHAR(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        elif dialect.name == 'postgresql':
            return str(value) if not isinstance(value, uuid.UUID) else value
        else:
            # For SQLite, always store as string
            if isinstance(value, uuid.UUID):
                return str(value)
            # If it's already a string, return as-is
            return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        else:
            if not isinstance(value, uuid.UUID):
                return uuid.UUID(value)
            return value


db = SQLAlchemy()


class UserRole(str, Enum):
    USER = 'user'
    ORG_ADMIN = 'org_admin'
    SUPER_ADMIN = 'super_admin'


class MembershipRole(str, Enum):
    MEMBER = 'member'
    ADMIN = 'admin'
    OWNER = 'owner'


class OrganizationStatus(str, Enum):
    ACTIVE = 'active'
    INACTIVE = 'inactive'
    SUSPENDED = 'suspended'


class ScanVerdict(str, Enum):
    SAFE = 'safe'
    SUSPICIOUS = 'suspicious'
    DANGEROUS = 'dangerous'


class ActivityType(str, Enum):
    USER_LOGIN = 'user_login'
    USER_LOGOUT = 'user_logout'
    USER_REGISTER = 'user_register'
    USER_PASSWORD_RESET = 'user_password_reset'
    USER_SSO_LOGIN = 'user_sso_login'
    SCAN_CREATED = 'scan_created'
    SCAN_VIEWED = 'scan_viewed'
    ORG_CREATED = 'org_created'
    ORG_UPDATED = 'org_updated'
    ORG_DELETED = 'org_deleted'
    ORG_MEMBER_ADDED = 'org_member_added'
    ORG_MEMBER_REMOVED = 'org_member_removed'
    ORG_MEMBER_ROLE_CHANGED = 'org_member_role_changed'
    ORG_SSO_CONFIGURED = 'org_sso_configured'
    ORG_SETTINGS_UPDATED = 'org_settings_updated'
    ADMIN_ORG_CREATED = 'admin_org_created'
    ADMIN_ORG_UPDATED = 'admin_org_updated'
    ADMIN_ORG_DELETED = 'admin_org_deleted'
    ADMIN_USER_CREATED = 'admin_user_created'
    ADMIN_USER_UPDATED = 'admin_user_updated'
    ADMIN_USER_DELETED = 'admin_user_deleted'
    EXTENSION_LINKED = 'extension_linked'
    EXTENSION_UNLINKED = 'extension_unlinked'
    USER_PROVISIONED = 'user_provisioned'
    USER_DEPROVISIONED = 'user_deprovisioned'
    USER_REACTIVATED = 'user_reactivated'
    USER_CREATED = 'user_created'
    AUTH_CONFIG_UPDATED = 'auth_config_updated'
    LICENSE_UPDATED = 'license_updated'
    LICENSE_SUSPENDED = 'license_suspended'
    LICENSE_REACTIVATED = 'license_reactivated'
    USER_INVITED = 'user_invited'
    USER_INVITE_ACCEPTED = 'user_invite_accepted'
    USER_INVITE_CANCELLED = 'user_invite_cancelled'
    USER_INVITE_RESENT = 'user_invite_resent'


class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(GUID(), primary_key=True, default=uuid.uuid4)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=True)
    first_name = db.Column(db.String(100), nullable=False)
    last_name = db.Column(db.String(100), nullable=False)
    role = db.Column(SQLEnum(UserRole), default=UserRole.USER, nullable=False, index=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    is_verified = db.Column(db.Boolean, default=False, nullable=False)
    last_login = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Provisioning fields
    is_provisioned = db.Column(db.Boolean, default=False, nullable=False)
    deprovisioned_at = db.Column(db.DateTime, nullable=True)
    auth_method = db.Column(db.String(50), default='password', nullable=False)  # password, sso, email_auth

    memberships = db.relationship('Membership', back_populates='user', cascade='all, delete-orphan')
    scans = db.relationship('Scan', back_populates='user', cascade='all, delete-orphan')
    activities = db.relationship('ActivityLog', back_populates='user', cascade='all, delete-orphan')
    extension_token = db.Column(db.String(255), unique=True, nullable=True, index=True)
    extension_linked_at = db.Column(db.DateTime, nullable=True)

    def __repr__(self):
        return f'<User {self.email}>'

    def to_dict(self, include_sensitive=False):
        data = {
            'id': str(self.id),
            'email': self.email,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'role': self.role.value,
            'is_active': self.is_active,
            'is_verified': self.is_verified,
            'is_provisioned': self.is_provisioned,
            'deprovisioned_at': self.deprovisioned_at.isoformat() if self.deprovisioned_at else None,
            'auth_method': self.auth_method,
            'last_login': self.last_login.isoformat() if self.last_login else None,
            'created_at': self.created_at.isoformat(),
            'extension_linked': self.extension_token is not None,
            'extension_linked_at': self.extension_linked_at.isoformat() if self.extension_linked_at else None,
        }
        if include_sensitive:
            data['memberships'] = [m.to_dict() for m in self.memberships]
        return data


class Organization(db.Model):
    __tablename__ = 'organizations'

    id = db.Column(GUID(), primary_key=True, default=uuid.uuid4)
    name = db.Column(db.String(255), nullable=False)
    slug = db.Column(db.String(100), unique=True, nullable=False, index=True)
    domain = db.Column(db.String(255), unique=True, nullable=True, index=True)
    status = db.Column(SQLEnum(OrganizationStatus), default=OrganizationStatus.ACTIVE, nullable=False)
    settings = db.Column(db.JSON, default=dict, nullable=False)
    sso_config = db.Column(db.JSON, default=dict, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # License fields
    plan_name = db.Column(db.String(50), nullable=True)  # starter, business, enterprise
    plan_status = db.Column(db.String(50), default='active', nullable=False)  # active, suspended, expired
    max_users = db.Column(db.Integer, default=5, nullable=False)
    scans_per_month = db.Column(db.Integer, default=100, nullable=False)
    monthly_scan_limit = db.Column(db.Integer, default=100, nullable=False)
    license_expiry = db.Column(db.DateTime, nullable=True)

    memberships = db.relationship('Membership', back_populates='organization', cascade='all, delete-orphan')
    scans = db.relationship('Scan', back_populates='organization', cascade='all, delete-orphan')
    activity_logs = db.relationship('ActivityLog', back_populates='organization', cascade='all, delete-orphan')
    auth_config = db.relationship('OrganizationAuthConfig', back_populates='organization', cascade='all, delete-orphan', uselist=False)
    invite_tokens = db.relationship('InviteToken', back_populates='organization', cascade='all, delete-orphan')

    def __repr__(self):
        return f'<Organization {self.name}>'

    def to_dict(self, include_sensitive=False):
        data = {
            'id': str(self.id),
            'name': self.name,
            'slug': self.slug,
            'domain': self.domain,
            'status': self.status.value,
            'settings': self.settings,
            'sso_configured': bool(self.sso_config.get('client_id')),
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'plan_name': self.plan_name,
            'plan_status': self.plan_status,
            'max_users': self.max_users,
            'scans_per_month': self.scans_per_month,
            'monthly_scan_limit': self.monthly_scan_limit,
            'license_expiry': self.license_expiry.isoformat() if self.license_expiry else None,
        }
        if include_sensitive:
            data['sso_config'] = {k: v for k, v in self.sso_config.items() if k != 'client_secret'}
        return data


class OrganizationAuthConfig(db.Model):
    __tablename__ = 'organization_auth_configs'

    id = db.Column(GUID(), primary_key=True, default=uuid.uuid4)
    organization_id = db.Column(GUID(), db.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False, unique=True, index=True)
    
    # Enabled authentication methods
    password_enabled = db.Column(db.Boolean, default=True, nullable=False)
    sso_enabled = db.Column(db.Boolean, default=False, nullable=False)
    email_auth_enabled = db.Column(db.Boolean, default=False, nullable=False)
    
    # SSO Configuration (generic for SAML/OIDC)
    sso_provider = db.Column(db.String(50), nullable=True)  # microsoft, google, okta, custom
    sso_client_id = db.Column(db.String(255), nullable=True)
    sso_client_secret = db.Column(db.String(255), nullable=True)
    sso_tenant_id = db.Column(db.String(255), nullable=True)
    sso_issuer = db.Column(db.String(255), nullable=True)
    sso_redirect_url = db.Column(db.String(500), nullable=True)
    sso_domain = db.Column(db.String(255), nullable=True)
    sso_metadata_url = db.Column(db.String(500), nullable=True)
    
    # Email auth configuration
    email_auth_domain = db.Column(db.String(255), nullable=True)
    email_auth_template = db.Column(db.Text, nullable=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    organization = db.relationship('Organization', back_populates='auth_config')

    def __repr__(self):
        return f'<OrganizationAuthConfig org={self.organization_id}>'

    def to_dict(self, include_sensitive=False):
        data = {
            'id': str(self.id),
            'organization_id': str(self.organization_id),
            'password_enabled': self.password_enabled,
            'sso_enabled': self.sso_enabled,
            'email_auth_enabled': self.email_auth_enabled,
            'sso_provider': self.sso_provider,
            'sso_client_id': self.sso_client_id,
            'sso_tenant_id': self.sso_tenant_id,
            'sso_issuer': self.sso_issuer,
            'sso_redirect_url': self.sso_redirect_url,
            'sso_domain': self.sso_domain,
            'sso_metadata_url': self.sso_metadata_url,
            'email_auth_domain': self.email_auth_domain,
            'configured': bool(self.sso_client_id),
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
        }
        if include_sensitive:
            data['sso_client_secret'] = self.sso_client_secret
            data['email_auth_template'] = self.email_auth_template
        return data


class InviteToken(db.Model):
    __tablename__ = 'invite_tokens'

    id = db.Column(GUID(), primary_key=True, default=uuid.uuid4)
    organization_id = db.Column(GUID(), db.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False, index=True)
    email = db.Column(db.String(255), nullable=False, index=True)
    first_name = db.Column(db.String(100), nullable=False)
    last_name = db.Column(db.String(100), nullable=False)
    token_hash = db.Column(db.String(255), nullable=False, unique=True, index=True)
    invited_by = db.Column(GUID(), db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    expires_at = db.Column(db.DateTime, nullable=False)
    accepted_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    organization = db.relationship('Organization', back_populates='invite_tokens')
    inviter = db.relationship('User', foreign_keys=[invited_by])

    def __repr__(self):
        return f'<InviteToken {self.email} org={self.organization_id}>'

    def to_dict(self, include_token=False):
        data = {
            'id': str(self.id),
            'organization_id': str(self.organization_id),
            'email': self.email,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'expires_at': self.expires_at.isoformat(),
            'accepted_at': self.accepted_at.isoformat() if self.accepted_at else None,
            'created_at': self.created_at.isoformat(),
            'invited_by': str(self.invited_by) if self.invited_by else None,
            'is_expired': datetime.utcnow() > self.expires_at,
            'is_accepted': self.accepted_at is not None,
        }
        if include_token:
            data['token'] = self.token_hash  # Only for the one-time response
        return data


class Membership(db.Model):
    __tablename__ = 'memberships'

    id = db.Column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id = db.Column(GUID(), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    organization_id = db.Column(GUID(), db.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False, index=True)
    role = db.Column(SQLEnum(MembershipRole), default=MembershipRole.MEMBER, nullable=False)
    joined_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    user = db.relationship('User', back_populates='memberships')
    organization = db.relationship('Organization', back_populates='memberships')

    __table_args__ = (
        db.UniqueConstraint('user_id', 'organization_id', name='uq_user_organization'),
    )

    def __repr__(self):
        return f'<Membership user={self.user_id} org={self.organization_id} role={self.role}>'

    def to_dict(self):
        return {
            'id': str(self.id),
            'user_id': str(self.user_id),
            'organization_id': str(self.organization_id),
            'role': self.role.value,
            'joined_at': self.joined_at.isoformat(),
            'user': self.user.to_dict() if self.user else None,
            'organization': self.organization.to_dict() if self.organization else None,
        }


class Scan(db.Model):
    __tablename__ = 'scans'

    id = db.Column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id = db.Column(GUID(), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    organization_id = db.Column(GUID(), db.ForeignKey('organizations.id', ondelete='SET NULL'), nullable=True, index=True)
    url = db.Column(db.Text, nullable=False)
    verdict = db.Column(SQLEnum(ScanVerdict), nullable=False)
    risk_score = db.Column(db.Integer, nullable=False)
    risk_color = db.Column(db.String(20), nullable=False)
    phishing_probability = db.Column(db.Float, nullable=False)
    prediction = db.Column(db.Integer, nullable=False)
    reasons = db.Column(db.JSON, default=list, nullable=False)
    stages = db.Column(db.JSON, default=dict, nullable=False)
    page_inspect_result = db.Column(db.JSON, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)

    user = db.relationship('User', back_populates='scans')
    organization = db.relationship('Organization', back_populates='scans')

    def __repr__(self):
        return f'<Scan {self.url[:50]} verdict={self.verdict}>'

    def to_dict(self, include_full=True):
        data = {
            'id': str(self.id),
            'url': self.url,
            'verdict': self.verdict.value,
            'risk_score': self.risk_score,
            'risk_color': self.risk_color,
            'phishing_probability': self.phishing_probability,
            'prediction': self.prediction,
            'reasons': self.reasons,
            'created_at': self.created_at.isoformat(),
        }
        if include_full:
            data['stages'] = self.stages
            data['page_inspect_result'] = self.page_inspect_result
        return data


class ActivityLog(db.Model):
    __tablename__ = 'activity_logs'

    id = db.Column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id = db.Column(GUID(), db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True)
    organization_id = db.Column(GUID(), db.ForeignKey('organizations.id', ondelete='SET NULL'), nullable=True, index=True)
    type = db.Column(SQLEnum(ActivityType), nullable=False, index=True)
    description = db.Column(db.Text, nullable=False)
    activity_metadata = db.Column(db.JSON, default=dict, nullable=False)
    ip_address = db.Column(db.String(45), nullable=True)
    user_agent = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)

    user = db.relationship('User', back_populates='activities')
    organization = db.relationship('Organization', back_populates='activity_logs')

    def __repr__(self):
        return f'<ActivityLog {self.type} user={self.user_id} org={self.organization_id}>'

    def to_dict(self):
        return {
            'id': str(self.id),
            'user_id': str(self.user_id) if self.user_id else None,
            'organization_id': str(self.organization_id) if self.organization_id else None,
            'type': self.type.value,
            'description': self.description,
            'metadata': self.activity_metadata,
            'ip_address': self.ip_address,
            'user_agent': self.user_agent,
            'created_at': self.created_at.isoformat(),
            'user': self.user.to_dict() if self.user else None,
        }


class UserGroup(db.Model):
    __tablename__ = 'user_groups'

    id = db.Column(GUID(), primary_key=True, default=uuid.uuid4)
    organization_id = db.Column(GUID(), db.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False, index=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    organization = db.relationship('Organization', foreign_keys=[organization_id])
    members = db.relationship('UserGroupMember', back_populates='group', cascade='all, delete-orphan')

    def __repr__(self):
        return f'<UserGroup {self.name} org={self.organization_id}>'

    def to_dict(self, include_members=False):
        data = {
            'id': str(self.id),
            'organization_id': str(self.organization_id),
            'name': self.name,
            'description': self.description,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'member_count': len(self.members) if self.members else 0,
        }
        if include_members:
            data['members'] = [m.to_dict() for m in self.members]
        return data


class UserGroupMember(db.Model):
    __tablename__ = 'user_group_members'

    id = db.Column(GUID(), primary_key=True, default=uuid.uuid4)
    group_id = db.Column(GUID(), db.ForeignKey('user_groups.id', ondelete='CASCADE'), nullable=False, index=True)
    user_id = db.Column(GUID(), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    group = db.relationship('UserGroup', back_populates='members')
    user = db.relationship('User', foreign_keys=[user_id])

    __table_args__ = (
        db.UniqueConstraint('group_id', 'user_id', name='uq_group_user'),
    )

    def __repr__(self):
        return f'<UserGroupMember group={self.group_id} user={self.user_id}>'

    def to_dict(self):
        return {
            'id': str(self.id),
            'group_id': str(self.group_id),
            'user_id': str(self.user_id),
            'created_at': self.created_at.isoformat(),
            'user': self.user.to_dict() if self.user else None,
        }


class RiskScoreBypassRule(db.Model):
    __tablename__ = 'risk_score_bypass_rules'

    id = db.Column(GUID(), primary_key=True, default=uuid.uuid4)
    scope = db.Column(db.String(50), nullable=False, index=True)  # global, organization, group, user
    target_id = db.Column(GUID(), nullable=True, index=True)  # null for global; org_id, group_id, or user_id
    organization_id = db.Column(GUID(), db.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=True, index=True)
    max_allowed_risk_score = db.Column(db.Integer, nullable=False, default=50)  # 1 to 100 percentage scale
    description = db.Column(db.String(255), nullable=True)
    created_by = db.Column(GUID(), db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    creator = db.relationship('User', foreign_keys=[created_by])
    organization = db.relationship('Organization', foreign_keys=[organization_id])

    def __repr__(self):
        return f'<RiskScoreBypassRule scope={self.scope} target={self.target_id} score={self.max_allowed_risk_score}>'

    def to_dict(self):
        return {
            'id': str(self.id),
            'scope': self.scope,
            'target_id': str(self.target_id) if self.target_id else None,
            'organization_id': str(self.organization_id) if self.organization_id else None,
            'max_allowed_risk_score': self.max_allowed_risk_score,
            'description': self.description,
            'created_by': str(self.created_by) if self.created_by else None,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
        }