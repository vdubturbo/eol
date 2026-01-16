import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { LoadingState } from '../components/common/LoadingState';
import { EmptyState } from '../components/common/EmptyState';
import { Search, Trash2, Shield, User, AlertCircle } from 'lucide-react';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: 'user' | 'admin';
  created_at: string;
  updated_at: string;
}

function useUsers() {
  return useQuery({
    queryKey: ['admin', 'users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as UserProfile[];
    }
  });
}

function useUpdateUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: 'user' | 'admin' }) => {
      const { error } = await supabase
        .from('user_profiles')
        .update({ role })
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    }
  });
}

function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      // Call server endpoint to delete user (requires service role key)
      const response = await fetch(`http://localhost:3001/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to delete user');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    }
  });
}

export default function AdminUsersPage() {
  const { profile: currentUserProfile } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data: users, isLoading, error } = useUsers();
  const updateRoleMutation = useUpdateUserRole();
  const deleteUserMutation = useDeleteUser();

  const filteredUsers = users?.filter(user =>
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleRoleChange = async (userId: string, newRole: 'user' | 'admin') => {
    // Prevent demoting self
    if (userId === currentUserProfile?.id && newRole !== 'admin') {
      alert('You cannot demote yourself from admin');
      return;
    }

    try {
      await updateRoleMutation.mutateAsync({ userId, role: newRole });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update role');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await deleteUserMutation.mutateAsync(userId);
      setDeleteConfirmId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete user');
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <LoadingState message="Loading users..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="flex items-center gap-2 p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-400">
          <AlertCircle className="h-5 w-5" />
          <span>Failed to load users: {error instanceof Error ? error.message : 'Unknown error'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-2">User Management</h1>
        <p className="text-gray-400 mb-8">
          Manage user accounts and roles
        </p>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by email or name..."
              className="w-full md:w-96 bg-bg-secondary border border-gray-700 rounded-lg pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:border-accent-primary focus:outline-none"
            />
          </div>
        </div>

        {/* Users Table */}
        {filteredUsers && filteredUsers.length > 0 ? (
          <div className="bg-bg-secondary border border-gray-800 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">User</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Role</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Created</th>
                  <th className="text-right px-6 py-4 text-sm font-medium text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-bg-tertiary/50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-accent-primary/20 flex items-center justify-center">
                          {user.role === 'admin' ? (
                            <Shield className="h-5 w-5 text-amber-400" />
                          ) : (
                            <User className="h-5 w-5 text-accent-primary" />
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-white">
                            {user.full_name || 'No name'}
                          </div>
                          <div className="text-xs text-gray-500">
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value as 'user' | 'admin')}
                        disabled={updateRoleMutation.isPending}
                        className={`bg-bg-primary border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-accent-primary ${
                          user.role === 'admin'
                            ? 'border-amber-800 text-amber-400'
                            : 'border-gray-700 text-gray-300'
                        }`}
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-400">
                      {formatDate(user.created_at)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end">
                        {user.id === currentUserProfile?.id ? (
                          <span className="text-xs text-gray-500 italic">Current user</span>
                        ) : deleteConfirmId === user.id ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleDeleteUser(user.id)}
                              disabled={deleteUserMutation.isPending}
                              className="px-3 py-1.5 text-xs font-medium bg-red-900/50 text-red-400 border border-red-800 rounded hover:bg-red-900 transition-colors"
                            >
                              {deleteUserMutation.isPending ? 'Deleting...' : 'Confirm'}
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-white transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmId(user.id)}
                            className="p-2 text-gray-500 hover:text-red-400 transition-colors"
                            title="Delete user"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No users found"
            description={searchQuery ? 'Try a different search term' : 'No users have signed up yet'}
          />
        )}

        {/* Stats */}
        {users && (
          <div className="mt-6 flex gap-6 text-sm text-gray-400">
            <div>
              Total users: <span className="text-white font-medium">{users.length}</span>
            </div>
            <div>
              Admins: <span className="text-amber-400 font-medium">{users.filter(u => u.role === 'admin').length}</span>
            </div>
            <div>
              Regular users: <span className="text-white font-medium">{users.filter(u => u.role === 'user').length}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
