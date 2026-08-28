from flask import Blueprint, request, jsonify, g
import uuid
from backend.models import (
    db, RiskScoreBypassRule, UserGroup, UserGroupMember, User, Organization, Membership, ActivityLog, ActivityType
)
from backend.auth_utils import require_auth, get_current_user

bypass_rules_bp = Blueprint('bypass_rules', __name__, url_prefix='/api/bypass-rules')
user_groups_bp = Blueprint('user_groups', __name__, url_prefix='/api/user-groups')


def _get_user_org_id(current_user):
    """Helper to get user's primary organization ID."""
    if current_user.get('org_id'):
        return current_user['org_id']
    membership = Membership.query.filter_by(user_id=current_user['sub']).first()
    if membership:
        return str(membership.organization_id)
    return None


# ============================================================================
# BYPASS RULES ENDPOINTS
# ============================================================================

@bypass_rules_bp.get('')
@require_auth
def list_bypass_rules():
    current = get_current_user()
    role = current.get('role')
    user_id = current.get('sub')
    org_id = _get_user_org_id(current)

    query = RiskScoreBypassRule.query

    if role == 'super_admin':
        # Super admin can filter by org_id or scope if provided
        target_org = request.args.get('organization_id')
        if target_org:
            query = query.filter((RiskScoreBypassRule.organization_id == target_org) | (RiskScoreBypassRule.scope == 'global'))
    elif role == 'org_admin':
        if not org_id:
            return jsonify({'rules': []})
        # Org admin sees global rules + rules for their organization
        query = query.filter(
            (RiskScoreBypassRule.scope == 'global') |
            (RiskScoreBypassRule.organization_id == org_id)
        )
    else:
        # Regular user sees rules relevant to them
        if org_id:
            query = query.filter(
                (RiskScoreBypassRule.scope == 'global') |
                (RiskScoreBypassRule.organization_id == org_id)
            )
        else:
            query = query.filter(RiskScoreBypassRule.scope == 'global')

    rules = query.order_by(RiskScoreBypassRule.created_at.desc()).all()
    
    # Enrich rule responses with target names for easy frontend display
    rules_data = []
    for r in rules:
        dict_data = r.to_dict()
        dict_data['target_name'] = 'Global'
        if r.scope == 'organization' and r.target_id:
            org = Organization.query.get(r.target_id)
            dict_data['target_name'] = org.name if org else 'Unknown Org'
        elif r.scope == 'group' and r.target_id:
            grp = UserGroup.query.get(r.target_id)
            dict_data['target_name'] = grp.name if grp else 'Unknown Group'
        elif r.scope == 'user' and r.target_id:
            usr = User.query.get(r.target_id)
            dict_data['target_name'] = f"{usr.first_name} {usr.last_name} ({usr.email})" if usr else 'Unknown User'
        rules_data.append(dict_data)

    return jsonify({'rules': rules_data})


@bypass_rules_bp.post('')
@require_auth
def create_bypass_rule():
    current = get_current_user()
    role = current.get('role')
    user_id = current.get('sub')
    org_id = _get_user_org_id(current)

    if role not in ['super_admin', 'org_admin']:
        return jsonify({'error': 'Unauthorized to create bypass rules'}), 403

    data = request.get_json(silent=True) or {}
    scope = (data.get('scope') or '').strip().lower()
    max_score = data.get('max_allowed_risk_score')
    target_id = data.get('target_id')
    description = (data.get('description') or '').strip()

    if scope not in ['global', 'organization', 'group', 'user']:
        return jsonify({'error': 'Invalid scope. Must be global, organization, group, or user'}), 400

    if max_score is None:
        return jsonify({'error': 'max_allowed_risk_score is required'}), 400

    try:
        max_score = int(max_score)
        if max_score < 1 or max_score > 100:
            raise ValueError()
    except (ValueError, TypeError):
        return jsonify({'error': 'max_allowed_risk_score must be an integer between 1 and 100'}), 400

    # Role permission checks
    rule_org_id = None
    if role == 'org_admin':
        if scope == 'global':
            return jsonify({'error': 'Org Admins cannot create global rules'}), 403
        rule_org_id = org_id
        if not rule_org_id:
            return jsonify({'error': 'Organization context missing'}), 400
    else:
        # Super admin
        if scope == 'global':
            rule_org_id = None
            target_id = None
        else:
            rule_org_id = data.get('organization_id') or org_id

    # Validate target_id according to scope
    if scope == 'organization':
        if not target_id:
            target_id = rule_org_id
        if role == 'org_admin' and str(target_id) != str(org_id):
            return jsonify({'error': 'Cannot create rule for another organization'}), 403
        org = Organization.query.get(target_id)
        if not org:
            return jsonify({'error': 'Target organization not found'}), 404
        rule_org_id = str(org.id)

    elif scope == 'group':
        if not target_id:
            return jsonify({'error': 'Group target_id is required'}), 400
        grp = UserGroup.query.get(target_id)
        if not grp:
            return jsonify({'error': 'Target group not found'}), 404
        if role == 'org_admin' and str(grp.organization_id) != str(org_id):
            return jsonify({'error': 'Target group does not belong to your organization'}), 403
        rule_org_id = str(grp.organization_id)

    elif scope == 'user':
        if not target_id:
            return jsonify({'error': 'User target_id is required'}), 400
        usr = User.query.get(target_id)
        if not usr:
            return jsonify({'error': 'Target user not found'}), 404
        if role == 'org_admin':
            # Check user membership in org
            mem = Membership.query.filter_by(user_id=usr.id, organization_id=org_id).first()
            if not mem:
                return jsonify({'error': 'Target user does not belong to your organization'}), 403
            rule_org_id = org_id
        else:
            # Super admin setting user rule: find user's primary org
            mem = Membership.query.filter_by(user_id=usr.id).first()
            if mem:
                rule_org_id = str(mem.organization_id)

    rule = RiskScoreBypassRule(
        scope=scope,
        target_id=target_id if scope != 'global' else None,
        organization_id=rule_org_id,
        max_allowed_risk_score=max_score,
        description=description,
        created_by=user_id
    )
    db.session.add(rule)
    db.session.commit()

    db.session.add(ActivityLog(
        user_id=user_id,
        organization_id=rule_org_id,
        type=ActivityType.ORG_SETTINGS_UPDATED,
        description=f'Created Risk Score Bypass Rule (scope: {scope}, allowed score: {max_score}%)',
        activity_metadata={'rule_id': str(rule.id), 'scope': scope, 'max_allowed_risk_score': max_score},
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    ))
    db.session.commit()

    res_data = rule.to_dict()
    res_data['target_name'] = 'Global'
    if scope == 'organization' and rule.target_id:
        o = Organization.query.get(rule.target_id)
        res_data['target_name'] = o.name if o else 'Unknown Org'
    elif scope == 'group' and rule.target_id:
        g = UserGroup.query.get(rule.target_id)
        res_data['target_name'] = g.name if g else 'Unknown Group'
    elif scope == 'user' and rule.target_id:
        u = User.query.get(rule.target_id)
        res_data['target_name'] = f"{u.first_name} {u.last_name}" if u else 'Unknown User'

    return jsonify({'rule': res_data}), 201


@bypass_rules_bp.put('/<rule_id>')
@require_auth
def update_bypass_rule(rule_id):
    current = get_current_user()
    role = current.get('role')
    user_id = current.get('sub')
    org_id = _get_user_org_id(current)

    rule = RiskScoreBypassRule.query.get(rule_id)
    if not rule:
        return jsonify({'error': 'Rule not found'}), 404

    if role == 'org_admin':
        if rule.scope == 'global' or str(rule.organization_id) != str(org_id):
            return jsonify({'error': 'Unauthorized to modify this rule'}), 403

    data = request.get_json(silent=True) or {}
    max_score = data.get('max_allowed_risk_score')
    description = data.get('description')

    if max_score is not None:
        try:
            max_score = int(max_score)
            if max_score < 1 or max_score > 100:
                raise ValueError()
            rule.max_allowed_risk_score = max_score
        except (ValueError, TypeError):
            return jsonify({'error': 'max_allowed_risk_score must be an integer between 1 and 100'}), 400

    if description is not None:
        rule.description = description.strip()

    db.session.commit()

    db.session.add(ActivityLog(
        user_id=user_id,
        organization_id=rule.organization_id,
        type=ActivityType.ORG_SETTINGS_UPDATED,
        description=f'Updated Risk Score Bypass Rule {rule.id} (allowed score: {rule.max_allowed_risk_score}%)',
        activity_metadata={'rule_id': str(rule.id), 'max_allowed_risk_score': rule.max_allowed_risk_score},
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    ))
    db.session.commit()

    res_data = rule.to_dict()
    res_data['target_name'] = 'Global'
    if rule.scope == 'organization' and rule.target_id:
        o = Organization.query.get(rule.target_id)
        res_data['target_name'] = o.name if o else 'Unknown Org'
    elif rule.scope == 'group' and rule.target_id:
        g = UserGroup.query.get(rule.target_id)
        res_data['target_name'] = g.name if g else 'Unknown Group'
    elif rule.scope == 'user' and rule.target_id:
        u = User.query.get(rule.target_id)
        res_data['target_name'] = f"{u.first_name} {u.last_name}" if u else 'Unknown User'

    return jsonify({'rule': res_data})


@bypass_rules_bp.delete('/<rule_id>')
@require_auth
def delete_bypass_rule(rule_id):
    current = get_current_user()
    role = current.get('role')
    user_id = current.get('sub')
    org_id = _get_user_org_id(current)

    rule = RiskScoreBypassRule.query.get(rule_id)
    if not rule:
        return jsonify({'error': 'Rule not found'}), 404

    if role == 'org_admin':
        if rule.scope == 'global' or str(rule.organization_id) != str(org_id):
            return jsonify({'error': 'Unauthorized to delete this rule'}), 403

    db.session.delete(rule)
    db.session.commit()

    db.session.add(ActivityLog(
        user_id=user_id,
        organization_id=rule.organization_id,
        type=ActivityType.ORG_SETTINGS_UPDATED,
        description=f'Deleted Risk Score Bypass Rule {rule_id}',
        activity_metadata={'deleted_rule_id': rule_id},
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    ))
    db.session.commit()

    return jsonify({'message': 'Rule deleted successfully'})


# ============================================================================
# USER GROUPS ENDPOINTS
# ============================================================================

@user_groups_bp.get('')
@require_auth
def list_user_groups():
    current = get_current_user()
    role = current.get('role')
    org_id = _get_user_org_id(current)

    target_org = request.args.get('organization_id') or org_id

    query = UserGroup.query
    if role == 'super_admin':
        if target_org:
            query = query.filter_by(organization_id=target_org)
    else:
        if not org_id:
            return jsonify({'groups': []})
        query = query.filter_by(organization_id=org_id)

    groups = query.order_by(UserGroup.created_at.desc()).all()
    return jsonify({'groups': [g.to_dict(include_members=True) for g in groups]})


@user_groups_bp.post('')
@require_auth
def create_user_group():
    current = get_current_user()
    role = current.get('role')
    user_id = current.get('sub')
    org_id = _get_user_org_id(current)

    if role not in ['super_admin', 'org_admin']:
        return jsonify({'error': 'Unauthorized to create user groups'}), 403

    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    description = (data.get('description') or '').strip()
    target_org = data.get('organization_id') or org_id

    if not name:
        return jsonify({'error': 'Group name is required'}), 400

    if role == 'org_admin':
        target_org = org_id

    if not target_org:
        return jsonify({'error': 'Organization ID is required'}), 400

    group = UserGroup(
        organization_id=target_org,
        name=name,
        description=description
    )
    db.session.add(group)
    db.session.commit()

    # Optional initial user IDs
    user_ids = data.get('user_ids', [])
    for uid in user_ids:
        mem = UserGroupMember(group_id=group.id, user_id=uid)
        db.session.add(mem)
    db.session.commit()

    return jsonify({'group': group.to_dict(include_members=True)}), 201


@user_groups_bp.delete('/<group_id>')
@require_auth
def delete_user_group(group_id):
    current = get_current_user()
    role = current.get('role')
    org_id = _get_user_org_id(current)

    group = UserGroup.query.get(group_id)
    if not group:
        return jsonify({'error': 'Group not found'}), 404

    if role == 'org_admin' and str(group.organization_id) != str(org_id):
        return jsonify({'error': 'Unauthorized to delete this group'}), 403

    db.session.delete(group)
    db.session.commit()
    return jsonify({'message': 'Group deleted successfully'})


@user_groups_bp.post('/<group_id>/members')
@require_auth
def update_group_members(group_id):
    current = get_current_user()
    role = current.get('role')
    org_id = _get_user_org_id(current)

    group = UserGroup.query.get(group_id)
    if not group:
        return jsonify({'error': 'Group not found'}), 404

    if role == 'org_admin' and str(group.organization_id) != str(org_id):
        return jsonify({'error': 'Unauthorized to modify this group'}), 403

    data = request.get_json(silent=True) or {}
    user_id_target = data.get('user_id')
    action = data.get('action', 'add')  # 'add' or 'remove'

    if not user_id_target:
        return jsonify({'error': 'user_id required'}), 400

    if action == 'add':
        existing = UserGroupMember.query.filter_by(group_id=group.id, user_id=user_id_target).first()
        if not existing:
            m = UserGroupMember(group_id=group.id, user_id=user_id_target)
            db.session.add(m)
            db.session.commit()
    elif action == 'remove':
        UserGroupMember.query.filter_by(group_id=group.id, user_id=user_id_target).delete()
        db.session.commit()

    return jsonify({'group': group.to_dict(include_members=True)})


def evaluate_bypass_rule(user_id, org_id, raw_risk_score):
    """
    Evaluates bypass rules in priority order: User -> Group -> Organization -> Global.
    Returns: dict or None
    dict contains:
      - 'bypassed': True/False
      - 'allowed_score': int (1-100 percentage)
      - 'matched_scope': string ('user', 'group', 'organization', 'global')
      - 'matched_rule_id': string
      - 'reason': string
    """
    if not user_id:
        return None

    def _get_threshold(score):
        # Support legacy 1-10 scores if any exist in DB
        return score * 10 if score <= 10 else score

    # Step 1: Check User-level rule
    user_rule = RiskScoreBypassRule.query.filter_by(scope='user', target_id=user_id).first()
    if user_rule:
        thresh = _get_threshold(user_rule.max_allowed_risk_score)
        bypassed = (raw_risk_score <= thresh)
        return {
            'bypassed': bypassed,
            'allowed_score': thresh,
            'matched_scope': 'user',
            'matched_rule_id': str(user_rule.id),
            'reason': f"[Bypass Rule Applied] Risk score ({raw_risk_score}%) is within allowed user threshold (<= {thresh}%)"
        }

    # Step 2: Check Group-level rule
    user_groups = UserGroupMember.query.filter_by(user_id=user_id).all()
    group_ids = [str(m.group_id) for m in user_groups]
    if group_ids:
        group_rules = RiskScoreBypassRule.query.filter(
            RiskScoreBypassRule.scope == 'group',
            RiskScoreBypassRule.target_id.in_(group_ids)
        ).all()
        if group_rules:
            best_rule = max(group_rules, key=lambda r: _get_threshold(r.max_allowed_risk_score))
            thresh = _get_threshold(best_rule.max_allowed_risk_score)
            bypassed = (raw_risk_score <= thresh)
            return {
                'bypassed': bypassed,
                'allowed_score': thresh,
                'matched_scope': 'group',
                'matched_rule_id': str(best_rule.id),
                'reason': f"[Bypass Rule Applied] Risk score ({raw_risk_score}%) is within allowed group threshold (<= {thresh}%)"
            }

    # Step 3: Check Organization-level rule
    if not org_id:
        mem = Membership.query.filter_by(user_id=user_id).first()
        if mem:
            org_id = str(mem.organization_id)

    if org_id:
        org_rule = RiskScoreBypassRule.query.filter_by(scope='organization', target_id=org_id).first()
        if org_rule:
            thresh = _get_threshold(org_rule.max_allowed_risk_score)
            bypassed = (raw_risk_score <= thresh)
            return {
                'bypassed': bypassed,
                'allowed_score': thresh,
                'matched_scope': 'organization',
                'matched_rule_id': str(org_rule.id),
                'reason': f"[Bypass Rule Applied] Risk score ({raw_risk_score}%) is within allowed organization threshold (<= {thresh}%)"
            }

    # Step 4: Check Global-level rule
    global_rule = RiskScoreBypassRule.query.filter_by(scope='global').first()
    if global_rule:
        thresh = _get_threshold(global_rule.max_allowed_risk_score)
        bypassed = (raw_risk_score <= thresh)
        return {
            'bypassed': bypassed,
            'allowed_score': thresh,
            'matched_scope': 'global',
            'matched_rule_id': str(global_rule.id),
            'reason': f"[Bypass Rule Applied] Risk score ({raw_risk_score}%) is within allowed global threshold (<= {thresh}%)"
        }

    return None

