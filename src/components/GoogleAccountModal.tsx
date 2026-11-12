import React, { useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import {
  updateUserProfileData,
  switchGoogleAccount,
  signInWithGoogle,
  logoutGoogle,
  loadUserProfileFromFirestore,
  auth,
} from '../lib/firebase.ts';
import { playClickSound, playSuccessSound } from '../utils/sound.ts';
import {
  X,
  User as UserIcon,
  Mail,
  Shield,
  KeyRound,
  RefreshCw,
  LogOut,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Edit3,
  Camera,
  Sparkles,
  Cloud,
  Check,
  Calendar,
  Layers,
  ArrowRightLeft,
} from 'lucide-react';

interface GoogleAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onUserUpdated: (user: User) => void;
  soundEnabled: boolean;
  onToast: (message: string) => void;
}

const AVATAR_PRESETS = [
  {
    name: 'Cyber Shield',
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
  },
  {
    name: 'Neon Grid',
    url: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=150&auto=format&fit=crop&q=80',
  },
  {
    name: 'Quantum Core',
    url: 'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?w=150&auto=format&fit=crop&q=80',
  },
  {
    name: 'Android Bot',
    url: 'https://images.unsplash.com/photo-1546776310-eef45dd6d63c?w=150&auto=format&fit=crop&q=80',
  },
  {
    name: 'Hacker Terminal',
    url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=150&auto=format&fit=crop&q=80',
  },
];

export const GoogleAccountModal: React.FC<GoogleAccountModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUserUpdated,
  soundEnabled,
  onToast,
}) => {
  const [displayName, setDisplayName] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync state whenever modal opens or currentUser changes
  useEffect(() => {
    if (currentUser) {
      setDisplayName(currentUser.displayName || '');
      setPhotoURL(currentUser.photoURL || '');
      setErrorMessage(null);
      setSaveSuccess(false);

      // Check if firestore has custom override
      loadUserProfileFromFirestore(currentUser.uid).then((firestoreData) => {
        if (firestoreData) {
          if (firestoreData.displayName) setDisplayName(firestoreData.displayName);
          if (firestoreData.photoUrl) setPhotoURL(firestoreData.photoUrl);
        }
      });
    } else {
      setDisplayName('');
      setPhotoURL('');
    }
  }, [currentUser, isOpen]);

  if (!isOpen) return null;

  const handleSaveProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentUser) return;

    if (!displayName.trim()) {
      setErrorMessage('El nombre para mostrar no puede estar vacío');
      return;
    }

    playClickSound(soundEnabled);
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const updated = await updateUserProfileData(displayName.trim(), photoURL.trim());
      // Reload current auth user to refresh state
      await auth.currentUser?.reload();
      if (auth.currentUser) {
        onUserUpdated(auth.currentUser);
      }
      playSuccessSound(soundEnabled);
      setSaveSuccess(true);
      onToast('¡Perfil de Google modificado y sincronizado correctamente!');
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err: any) {
      console.error('Error saving profile:', err);
      setErrorMessage(err.message || 'Error al actualizar el perfil de la cuenta');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSwitchAccount = async () => {
    playClickSound(soundEnabled);
    setIsSwitching(true);
    setErrorMessage(null);

    try {
      const result = await switchGoogleAccount();
      if (result.user) {
        onUserUpdated(result.user);
        playSuccessSound(soundEnabled);
        onToast(`Cuenta cambiada a: ${result.user.displayName || result.user.email}`);
      }
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        console.error('Switch account error:', err);
        setErrorMessage('No se pudo cambiar de cuenta. Inténtalo de nuevo.');
      }
    } finally {
      setIsSwitching(false);
    }
  };

  const handleSignIn = async () => {
    playClickSound(soundEnabled);
    setIsLoggingIn(true);
    setErrorMessage(null);

    try {
      const result = await signInWithGoogle();
      if (result?.user) {
        onUserUpdated(result.user);
        playSuccessSound(soundEnabled);
        onToast(`¡Bienvenido ${result.user.displayName || result.user.email}!`);
      }
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        console.error('Sign in error:', err);
        setErrorMessage('No se pudo iniciar sesión con Google.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSignOut = async () => {
    playClickSound(soundEnabled);
    try {
      await logoutGoogle();
      onToast('Sesión de Google cerrada.');
      onClose();
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const handleForceSync = async () => {
    if (!currentUser) return;
    playClickSound(soundEnabled);
    setIsSyncing(true);
    try {
      await updateUserProfileData(
        displayName || currentUser.displayName || 'Usuario',
        photoURL || currentUser.photoURL || ''
      );
      playSuccessSound(soundEnabled);
      onToast('☁️ Nube de Firestore sincronizada al 100%');
    } catch (err: any) {
      setErrorMessage('Error al sincronizar con Firestore');
    } finally {
      setIsSyncing(false);
    }
  };

  const creationDate = currentUser?.metadata?.creationTime
    ? new Date(currentUser.metadata.creationTime).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : 'Reciente';

  const lastLogin = currentUser?.metadata?.lastSignInTime
    ? new Date(currentUser.metadata.lastSignInTime).toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Activo';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-xl max-h-[92vh] overflow-y-auto bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl shadow-cyan-950/60 p-5 sm:p-7 flex flex-col gap-5 text-slate-100 custom-scrollbar">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white flex items-center justify-center shadow-md p-2">
              <svg className="w-6 h-6" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <span>Cuenta Google Integrada</span>
                {currentUser && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/40 text-emerald-300 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Conectado
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                Administra, edita los datos de perfil y modifica la vinculación con Google OAuth
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              playClickSound(soundEnabled);
              onClose();
            }}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="bg-rose-950/70 border border-rose-500/50 rounded-2xl p-3 flex items-center gap-2.5 text-xs text-rose-200">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Success message */}
        {saveSuccess && (
          <div className="bg-emerald-950/70 border border-emerald-500/50 rounded-2xl p-3 flex items-center gap-2.5 text-xs text-emerald-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Los cambios de perfil se han guardado con éxito en Firebase Auth y Firestore.</span>
          </div>
        )}

        {/* State 1: When user is signed in */}
        {currentUser ? (
          <div className="flex flex-col gap-5">
            {/* Account Card Banner */}
            <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-4">
              <div className="relative shrink-0">
                {photoURL ? (
                  <img
                    src={photoURL}
                    alt={displayName || 'Avatar'}
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-cyan-500/60 shadow-lg shadow-cyan-950/50"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-cyan-600 font-extrabold text-2xl flex items-center justify-center text-white border-2 border-cyan-400 shadow-lg">
                    {(displayName || currentUser.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                <div
                  className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center"
                  title="Cuenta de Google vinculada"
                >
                  <div className="w-3.5 h-3.5 rounded-full bg-emerald-400 animate-pulse" />
                </div>
              </div>

              <div className="flex-1 text-center sm:text-left min-w-0">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <h3 className="text-base font-bold text-white truncate max-w-[220px]">
                    {displayName || currentUser.displayName || 'Usuario de Google'}
                  </h3>
                  <span className="text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-800/80 px-2 py-0.5 rounded-full font-medium">
                    Google OAuth
                  </span>
                </div>
                <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs text-slate-300 mt-1 font-mono">
                  <Mail className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="truncate">{currentUser.email}</span>
                  {currentUser.emailVerified && (
                    <span className="text-[10px] text-emerald-400 font-semibold" title="Email verificado por Google">
                      (Verificado)
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-[11px] text-slate-400 mt-2">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" /> Creado: {creationDate}
                  </span>
                  <span className="flex items-center gap-1">
                    <Layers className="w-3 h-3 text-slate-400" /> Último login: {lastLogin}
                  </span>
                </div>
              </div>
            </div>

            {/* Form to Edit Profile Data */}
            <form onSubmit={handleSaveProfile} className="flex flex-col gap-4 bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5" /> Modificar Datos de Perfil
                </h4>
                <span className="text-[10px] text-slate-400 font-mono">Sincronización en vivo</span>
              </div>

              {/* Display Name Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                  <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                  <span>Nombre para Mostrar (Display Name)</span>
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Tu nombre o alias de seguridad..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all font-medium"
                />
              </div>

              {/* Photo URL Input */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-slate-400" />
                    <span>URL del Avatar / Foto de Perfil</span>
                  </label>
                  {currentUser.photoURL && photoURL !== currentUser.photoURL && (
                    <button
                      type="button"
                      onClick={() => setPhotoURL(currentUser.photoURL || '')}
                      className="text-[10px] text-cyan-400 hover:underline"
                    >
                      Restaurar foto original de Google
                    </button>
                  )}
                </div>
                <input
                  type="url"
                  value={photoURL}
                  onChange={(e) => setPhotoURL(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all font-mono"
                />
              </div>

              {/* Preset Avatars Selection */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold text-slate-400">O elige un avatar cibernético rápido:</span>
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {AVATAR_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => {
                        playClickSound(soundEnabled);
                        setPhotoURL(preset.url);
                      }}
                      className={`relative w-10 h-10 rounded-xl overflow-hidden shrink-0 border-2 transition-all hover:scale-105 ${
                        photoURL === preset.url
                          ? 'border-cyan-400 ring-2 ring-cyan-500/30'
                          : 'border-slate-700 opacity-70 hover:opacity-100'
                      }`}
                      title={preset.name}
                    >
                      <img src={preset.url} alt={preset.name} className="w-full h-full object-cover" />
                      {photoURL === preset.url && (
                        <div className="absolute inset-0 bg-cyan-500/30 flex items-center justify-center">
                          <Check className="w-3 h-3 text-white stroke-[3]" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Save Button */}
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-teal-400 hover:from-cyan-400 hover:to-teal-300 text-slate-950 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSaving ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  <span>{isSaving ? 'Guardando en la Nube...' : 'Guardar Modificaciones'}</span>
                </button>
              </div>
            </form>

            {/* Cloud & Device Sync Status Box */}
            <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Cloud className="w-3.5 h-3.5 text-cyan-400" /> Base de Datos Firestore (GCP)
                </span>
                <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Sincronización Activa
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Tus patrones de desbloqueo, auditorías de seguridad, intentos de acceso y datos de la bóveda quedan cifrados y sincronizados con tu UID:
                <span className="font-mono text-[10px] text-cyan-300 ml-1 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                  {currentUser.uid}
                </span>
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleForceSync}
                  disabled={isSyncing}
                  className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className={`w-3 h-3 text-cyan-400 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Sincronizando...' : 'Forzar Sincronización'}</span>
                </button>
              </div>
            </div>

            {/* Danger / Account Switching Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={handleSwitchAccount}
                disabled={isSwitching}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                title="Selecciona otra cuenta de Google para iniciar sesión"
              >
                <ArrowRightLeft className={`w-3.5 h-3.5 text-cyan-400 ${isSwitching ? 'animate-spin' : ''}`} />
                <span>{isSwitching ? 'Abriendo selector...' : 'Cambiar de Cuenta Google'}</span>
              </button>

              <button
                type="button"
                onClick={handleSignOut}
                className="px-3.5 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900 border border-rose-800/80 text-rose-300 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-400" />
                <span>Cerrar Sesión</span>
              </button>
            </div>
          </div>
        ) : (
          /* State 2: When user is not signed in */
          <div className="flex flex-col items-center justify-center py-6 text-center gap-5">
            <div className="w-16 h-16 rounded-3xl bg-slate-950 border border-slate-800 flex items-center justify-center shadow-inner">
              <Cloud className="w-8 h-8 text-cyan-400 animate-pulse" />
            </div>

            <div className="max-w-md flex flex-col gap-2">
              <h3 className="text-base font-bold text-white">No hay ninguna cuenta Google conectada</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Vincula tu cuenta de Google mediante OAuth 2.0 para respaldar tus contraseñas y patrones en la nube cifrada de Firestore, sincronizar dispositivos remotos y habilitar auditoría de seguridad.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-md text-left text-xs text-slate-300">
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Respaldo en la nube seguro con encriptación</span>
              </div>
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Historial de auditoría de intentos y ataques</span>
              </div>
            </div>

            <button
              onClick={handleSignIn}
              disabled={isLoggingIn}
              className="mt-2 px-6 py-3 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-sm flex items-center gap-2.5 transition-all shadow-xl shadow-cyan-950/30 active:scale-95 disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              <span>{isLoggingIn ? 'Conectando con Google...' : 'Conectar con Google OAuth'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
