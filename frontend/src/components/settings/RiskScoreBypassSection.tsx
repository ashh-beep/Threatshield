import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/Card';
import { Button } from '@components/ui/Button';
import { Badge } from '@components/ui/Badge';
import { Input } from '@components/ui/Input';
import { api } from '@services/api';
import type { RiskScoreBypassRule, UserGroup, User, Organization } from '@services/api';
import { useAuth } from '@context/AuthContext';

interface RiskScoreBypassSectionProps {
  isSuperAdmin?: boolean;
}

// Sleek Custom Modal Component
function CustomModal({
  isOpen,
  onClose,
  title,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 border border-gray-200 dark:border-gray-700 z-10">
        <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl font-bold p-1"
          >
            &times;
          </button>
        </div>
        <div className="pt-4">{children}</div>
      </div>
    </div>
  );
}

export function RiskScoreBypassSection({ isSuperAdmin = false }: RiskScoreBypassSectionProps) {
  const { user } = useAuth();
  const [rules, setRules] = useState<RiskScoreBypassRule[]>([]);
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // New Rule Form state
  const [scope, setScope] = useState<'global' | 'organization' | 'group' | 'user'>(
    isSuperAdmin ? 'global' : 'organization'
  );
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [targetId, setTargetId] = useState<string>('');
  const [maxRiskScore, setMaxRiskScore] = useState<number>(5);
  const [description, setDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit Modal State
  const [editingRule, setEditingRule] = useState<RiskScoreBypassRule | null>(null);
  const [editScore, setEditScore] = useState<number>(5);
  const [editDesc, setEditDesc] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Group Management Modal State
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [selectedGroupForMembers, setSelectedGroupForMembers] = useState<UserGroup | null>(null);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  const primaryOrgId = user?.memberships?.[0]?.organization_id;

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const effectiveOrgId = isSuperAdmin ? (selectedOrgId || undefined) : primaryOrgId;

      const rulesRes = await api.getBypassRules(effectiveOrgId);
      setRules(rulesRes.rules || []);

      const groupsRes = await api.getUserGroups(effectiveOrgId);
      setGroups(groupsRes.groups || []);

      if (isSuperAdmin) {
        const orgsRes = await api.adminListOrganizations({ per_page: 100 });
        setOrganizations(orgsRes.organizations || []);
        
        const usersRes = await api.adminListUsers({ per_page: 100 });
        setUsers(usersRes.users || []);
      } else if (primaryOrgId) {
        const usersRes = await api.orgAdminListUsers({ per_page: 100 });
        setUsers(usersRes.users || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bypass configuration');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedOrgId]);

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (scope !== 'global' && !targetId && scope !== 'organization') {
      setError('Please select a target for the rule scope.');
      return;
    }

    setIsSubmitting(true);
    try {
      let finalTargetId = targetId;
      if (scope === 'organization') {
        finalTargetId = isSuperAdmin ? selectedOrgId : primaryOrgId || '';
      }

      await api.createBypassRule({
        scope,
        max_allowed_risk_score: maxRiskScore,
        target_id: scope === 'global' ? null : finalTargetId,
        organization_id: isSuperAdmin ? (selectedOrgId || null) : primaryOrgId,
        description: description.trim(),
      });

      setSuccessMsg('Risk score bypass rule created successfully!');
      setDescription('');
      setTargetId('');
      setMaxRiskScore(5);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to create bypass rule.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEdit = (rule: RiskScoreBypassRule) => {
    setEditingRule(rule);
    setEditScore(rule.max_allowed_risk_score);
    setEditDesc(rule.description || '');
  };

  const handleSaveEdit = async () => {
    if (!editingRule) return;
    setIsUpdating(true);
    try {
      await api.updateBypassRule(editingRule.id, {
        max_allowed_risk_score: editScore,
        description: editDesc,
      });
      setSuccessMsg('Bypass rule updated successfully!');
      setEditingRule(null);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to update rule.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!window.confirm('Are you sure you want to delete this bypass rule?')) return;
    try {
      await api.deleteBypassRule(ruleId);
      setSuccessMsg('Bypass rule deleted.');
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete rule.');
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    setIsCreatingGroup(true);
    try {
      await api.createUserGroup({
        name: newGroupName.trim(),
        description: newGroupDesc.trim(),
        organization_id: isSuperAdmin ? (selectedOrgId || primaryOrgId) : primaryOrgId,
      });
      setNewGroupName('');
      setNewGroupDesc('');
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to create group');
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!window.confirm('Delete this user group?')) return;
    try {
      await api.deleteUserGroup(groupId);
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete group');
    }
  };

  const handleToggleMember = async (group: UserGroup, userId: string, isMember: boolean) => {
    try {
      const res = await api.updateGroupMember(group.id, userId, isMember ? 'remove' : 'add');
      setSelectedGroupForMembers(res.group);
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to update group members');
    }
  };

  const getScoreColorBadge = (score: number) => {
    if (score <= 3) {
      return <Badge variant="success" size="md">Strict (Score ≤ {score})</Badge>;
    } else if (score <= 7) {
      return <Badge variant="warning" size="md">Moderate (Score ≤ {score})</Badge>;
    } else {
      return <Badge variant="danger" size="md">Permissive (Score ≤ {score})</Badge>;
    }
  };

  const getScopeBadge = (ruleScope: string) => {
    switch (ruleScope) {
      case 'global':
        return <Badge variant="danger" size="sm">GLOBAL</Badge>;
      case 'organization':
        return <Badge variant="warning" size="sm">ORGANIZATION</Badge>;
      case 'group':
        return <Badge variant="info" size="sm">GROUP</Badge>;
      case 'user':
        return <Badge variant="default" size="sm">USER</Badge>;
      default:
        return <Badge variant="default" size="sm">{ruleScope.toUpperCase()}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Risk Score Bypass Configuration Card */}
      <Card variant="outlined" className="border-gray-200 dark:border-gray-700 shadow-sm">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <span>Risk Score Bypass Configuration</span>
              <Badge variant="info" size="sm">Active</Badge>
            </CardTitle>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Configure allowed phishing risk score thresholds (1–10) using the interactive slider. Applied in strict priority order: <strong className="text-indigo-600 dark:text-indigo-400">User → Group → Organization → Global</strong>.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsGroupModalOpen(true)}
            className="shrink-0"
          >
            Manage User Groups ({groups.length})
          </Button>
        </CardHeader>

        <CardContent className="pt-0 space-y-6">
          {error && (
            <div className="p-4 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="p-4 rounded-lg border border-green-200 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 text-sm">
              {successMsg}
            </div>
          )}

          {/* Create Rule Form */}
          <form onSubmit={handleCreateRule} className="p-5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/40 space-y-5">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-base">Add New Bypass Rule</h3>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {/* Scope Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Scope
                </label>
                <select
                  value={scope}
                  onChange={(e: any) => {
                    setScope(e.target.value);
                    setTargetId('');
                  }}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-indigo-500"
                >
                  {isSuperAdmin && <option value="global">Global (All Organizations)</option>}
                  <option value="organization">Organization-wide</option>
                  <option value="group">User Group</option>
                  <option value="user">Individual User</option>
                </select>
              </div>

              {/* Org Selector (For Super Admin choosing org) */}
              {isSuperAdmin && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Target Organization
                  </label>
                  <select
                    value={selectedOrgId}
                    onChange={(e) => {
                      setSelectedOrgId(e.target.value);
                      setTargetId('');
                    }}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select Organization...</option>
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>{org.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Dynamic Target Selector */}
              {scope === 'group' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Select User Group
                  </label>
                  <select
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select Group...</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>{g.name} ({g.member_count} members)</option>
                    ))}
                  </select>
                </div>
              )}

              {scope === 'user' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Select Individual User
                  </label>
                  <select
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select User...</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.first_name} {u.last_name} ({u.email})</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Slider Section */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Allowed Phishing Risk Score Threshold (1–10)
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                    {maxRiskScore}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">/ 10</span>
                  {getScoreColorBadge(maxRiskScore)}
                </div>
              </div>

              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={maxRiskScore}
                onChange={(e) => setMaxRiskScore(parseInt(e.target.value, 10))}
                className="w-full h-2.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1 font-mono">
                <span>1 (Strict protection ≤10%)</span>
                <span>5 (Medium ≤50%)</span>
                <span>10 (Permissive ≤100%)</span>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Rule Note / Description (Optional)
              </label>
              <Input
                placeholder="e.g., Allow internal compliance testing scans for QA team"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting}
              className="w-full sm:w-auto"
            >
              {isSubmitting ? 'Saving Rule...' : 'Save Bypass Rule'}
            </Button>
          </form>

          {/* Active Rules List */}
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-base mb-4">
              Active Bypass Rules ({rules.length})
            </h3>

            {isLoading ? (
              <div className="p-8 text-center text-gray-500 animate-pulse">Loading rules...</div>
            ) : rules.length === 0 ? (
              <div className="p-8 text-center text-gray-500 border border-dashed rounded-lg">
                No bypass rules configured yet. Scans will use standard ML threat detection.
              </div>
            ) : (
              <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-xl">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800/80 text-gray-600 dark:text-gray-300 font-medium border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="px-4 py-3">Scope</th>
                      <th className="px-4 py-3">Target</th>
                      <th className="px-4 py-3">Allowed Risk Score</th>
                      <th className="px-4 py-3">Note</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {rules.map((r) => (
                      <tr key={r.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="px-4 py-3.5 font-medium">{getScopeBadge(r.scope)}</td>
                        <td className="px-4 py-3.5 text-gray-900 dark:text-gray-100 font-medium">
                          {r.target_name || 'Global'}
                        </td>
                        <td className="px-4 py-3.5 font-mono">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-indigo-600 dark:text-indigo-400">{r.max_allowed_risk_score} / 10</span>
                            <span className="text-xs text-gray-500"> (≤ {r.max_allowed_risk_score * 10}%)</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-gray-500 dark:text-gray-400">
                          {r.description || '—'}
                        </td>
                        <td className="px-4 py-3.5 text-right space-x-2">
                          <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(r)}>
                            Edit
                          </Button>
                          <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => handleDeleteRule(r.id)}>
                            Delete
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Rule Modal */}
      <CustomModal
        isOpen={!!editingRule}
        onClose={() => setEditingRule(null)}
        title="Edit Risk Score Bypass Rule"
      >
        <div className="space-y-5 pt-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Target Scope & Name
            </label>
            <div className="p-3 bg-gray-100 dark:bg-gray-700/60 rounded-lg text-sm font-medium">
              {editingRule?.scope.toUpperCase()} — {editingRule?.target_name || 'Global'}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Allowed Risk Score Threshold (1–10)
              </label>
              <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                {editScore} / 10
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              value={editScore}
              onChange={(e) => setEditScore(parseInt(e.target.value, 10))}
              className="w-full h-2.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <Input
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              placeholder="Rule description..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <Button variant="outline" onClick={() => setEditingRule(null)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={isUpdating} onClick={handleSaveEdit}>
              {isUpdating ? 'Updating...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </CustomModal>

      {/* User Groups Management Modal */}
      <CustomModal
        isOpen={isGroupModalOpen}
        onClose={() => {
          setIsGroupModalOpen(false);
          setSelectedGroupForMembers(null);
        }}
        title="User Group Management"
      >
        <div className="space-y-6">
          {/* Create Group Form */}
          <form onSubmit={handleCreateGroup} className="p-4 bg-gray-50 dark:bg-gray-700/40 rounded-xl space-y-3">
            <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100">Create New User Group</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                placeholder="Group Name (e.g. Finance)"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                required
              />
              <Input
                placeholder="Description"
                value={newGroupDesc}
                onChange={(e) => setNewGroupDesc(e.target.value)}
              />
            </div>
            <Button type="submit" variant="primary" size="sm" disabled={isCreatingGroup}>
              {isCreatingGroup ? 'Creating...' : 'Create Group'}
            </Button>
          </form>

          {/* Groups List */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100">Existing Groups</h4>
            {groups.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No user groups created yet.</p>
            ) : (
              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {groups.map((g) => (
                  <div key={g.id} className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg flex items-center justify-between">
                    <div>
                      <h5 className="font-medium text-sm text-gray-900 dark:text-gray-100">{g.name}</h5>
                      <p className="text-xs text-gray-500">{g.description || 'No description'} • {g.member_count} members</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedGroupForMembers(selectedGroupForMembers?.id === g.id ? null : g)}
                      >
                        {selectedGroupForMembers?.id === g.id ? 'Close Members' : 'Members'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => handleDeleteGroup(g.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Manage Members of Selected Group */}
          {selectedGroupForMembers && (
            <div className="p-4 border border-indigo-200 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-900/20 rounded-xl space-y-3">
              <h4 className="font-semibold text-sm text-indigo-900 dark:text-indigo-200">
                Members of "{selectedGroupForMembers.name}"
              </h4>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {users.map((u) => {
                  const isMember = selectedGroupForMembers.members?.some((m) => m.user_id === u.id);
                  return (
                    <div key={u.id} className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded-md border text-sm">
                      <span>{u.first_name} {u.last_name} ({u.email})</span>
                      <Button
                        variant={isMember ? 'outline' : 'primary'}
                        size="sm"
                        onClick={() => handleToggleMember(selectedGroupForMembers, u.id, !!isMember)}
                      >
                        {isMember ? 'Remove' : 'Add'}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </CustomModal>
    </div>
  );
}
