'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function ChangePasswordForm({ email }: { email: string }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess(false)

    if (newPassword.length < 8) {
      setError('A nova senha deve ter no mínimo 8 caracteres')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem')
      return
    }

    setLoading(true)
    const supabase = createClient()

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    })

    if (signInError) {
      setError('Senha atual incorreta')
      setLoading(false)
      return
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
      <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Alterar senha</p>

      <div className="space-y-3 max-w-sm">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Senha atual</label>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={currentPassword}
            onChange={e => setCurrentPassword(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#0d1e45]/30"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Nova senha</label>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#0d1e45]/30"
            placeholder="Mínimo 8 caracteres"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Confirmar nova senha</label>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#0d1e45]/30"
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 max-w-sm">{error}</p>
      )}
      {success && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 max-w-sm">Senha alterada com sucesso.</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="text-sm font-semibold px-4 py-2 rounded-lg bg-[#0d1e45] text-white hover:bg-[#162b5e] disabled:opacity-50 transition-colors"
      >
        {loading ? 'Salvando...' : 'Salvar nova senha'}
      </button>
    </form>
  )
}
