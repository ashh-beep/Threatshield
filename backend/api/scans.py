from flask import Blueprint, request, jsonify, g
from sqlalchemy import func

from backend.models import db, Scan, ScanVerdict, User, Organization, Membership, MembershipRole, ActivityLog, ActivityType
from backend.auth_utils import require_auth, require_role, require_org_access, get_current_user

scans_bp = Blueprint('scans', __name__, url_prefix='/api/scans')


@scans_bp.post('')
@require_auth
def create_scan():
    current = get_current_user()
    user_id = current['sub']

    data = request.get_json(silent=True) or {}
    url = (data.get('url') or '').strip()
    organization_id = data.get('organization_id')

    if not url:
        return jsonify({'error': 'URL required'}), 400

    org_id = None
    if organization_id:
        membership = Membership.query.filter_by(user_id=user_id, organization_id=organization_id).first()
        if membership:
            org_id = organization_id
    elif current.get('org_id'):
        org_id = current['org_id']

    scan = Scan(
        user_id=user_id,
        organization_id=org_id,
        url=url,
        verdict=data.get('verdict', 'safe'),
        risk_score=data.get('risk_score', 1),
        risk_color=data.get('risk_color', 'green'),
        phishing_probability=data.get('phishing_probability', 0.0),
        prediction=data.get('prediction', -1),
        reasons=data.get('reasons', []),
        stages=data.get('stages', {}),
        page_inspect_result=data.get('page_inspect_result')
    )
    db.session.add(scan)
    db.session.commit()

    db.session.add(ActivityLog(
        user_id=user_id,
        organization_id=org_id,
        type=ActivityType.SCAN_CREATED,
        description=f'Scanned URL: {url}',
        metadata={'scan_id': str(scan.id), 'verdict': scan.verdict.value, 'risk_score': scan.risk_score},
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    ))
    db.session.commit()

    return jsonify({'scan': scan.to_dict()}), 201


@scans_bp.get('')
@require_auth
def list_scans():
    current = get_current_user()
    user_id = current['sub']

    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 20, type=int), 100)
    verdict_filter = request.args.get('verdict')
    org_id = request.args.get('org_id')

    query = Scan.query

    if current['role'] == 'super_admin':
        pass
    elif org_id:
        membership = Membership.query.filter_by(user_id=user_id, organization_id=org_id).first()
        if membership:
            query = query.filter(Scan.organization_id == org_id)
        else:
            query = query.filter(Scan.user_id == user_id)
    else:
        query = query.filter(Scan.user_id == user_id)

    if verdict_filter:
        try:
            query = query.filter(Scan.verdict == ScanVerdict(verdict_filter))
        except ValueError:
            pass

    pagination = query.order_by(Scan.created_at.desc()).paginate(
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


@scans_bp.get('/<scan_id>')
@require_auth
def get_scan(scan_id):
    current = get_current_user()
    scan = Scan.query.get(scan_id)
    if not scan:
        return jsonify({'error': 'Scan not found'}), 404

    if current['role'] != 'super_admin':
        if str(scan.user_id) != current['sub']:
            if scan.organization_id:
                membership = Membership.query.filter_by(user_id=current['sub'], organization_id=str(scan.organization_id)).first()
                if not membership:
                    return jsonify({'error': 'Access denied'}), 403
            else:
                return jsonify({'error': 'Access denied'}), 403

    db.session.add(ActivityLog(
        user_id=current['sub'],
        organization_id=str(scan.organization_id) if scan.organization_id else None,
        type=ActivityType.SCAN_VIEWED,
        description=f'Viewed scan details: {scan.url}',
        metadata={'scan_id': str(scan.id)},
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent')
    ))
    db.session.commit()

    return jsonify({'scan': scan.to_dict(include_full=True)})


@scans_bp.delete('/<scan_id>')
@require_auth
def delete_scan(scan_id):
    current = get_current_user()
    scan = Scan.query.get(scan_id)
    if not scan:
        return jsonify({'error': 'Scan not found'}), 404

    if current['role'] != 'super_admin' and str(scan.user_id) != current['sub']:
        return jsonify({'error': 'Access denied'}), 403

    db.session.delete(scan)
    db.session.commit()

    return jsonify({'message': 'Scan deleted'})


@scans_bp.get('/stats/summary')
@require_auth
def scan_stats():
    current = get_current_user()
    user_id = current['sub']

    org_id = request.args.get('org_id')

    query = Scan.query
    if current['role'] == 'super_admin':
        if org_id:
            query = query.filter(Scan.organization_id == org_id)
    elif org_id:
        membership = Membership.query.filter_by(user_id=user_id, organization_id=org_id).first()
        if membership:
            query = query.filter(Scan.organization_id == org_id)
        else:
            query = query.filter(Scan.user_id == user_id)
    else:
        query = query.filter(Scan.user_id == user_id)

    total = query.count()
    dangerous = query.filter(Scan.verdict == ScanVerdict.DANGEROUS).count()
    suspicious = query.filter(Scan.verdict == ScanVerdict.SUSPICIOUS).count()
    safe = query.filter(Scan.verdict == ScanVerdict.SAFE).count()

    recent = query.order_by(Scan.created_at.desc()).limit(10).all()

    return jsonify({
        'total': total,
        'dangerous': dangerous,
        'suspicious': suspicious,
        'safe': safe,
        'recent': [s.to_dict() for s in recent]
    })