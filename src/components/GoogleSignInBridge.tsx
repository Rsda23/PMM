import React, { useEffect } from 'react';
import { useGoogleSignIn } from '../hooks/useGoogleSignIn';
import GoogleButton from './ui/GoogleButton';

type Props = {
  disabled?: boolean;
  onError: (message: string) => void;
  onLoadingChange?: (loading: boolean) => void;
};

/** Monte useGoogleSignIn uniquement quand les client IDs sont présents (évite le crash iOS). */
export default function GoogleSignInBridge({
  disabled = false,
  onError,
  onLoadingChange,
}: Props) {
  const { signIn, loading, isReady } = useGoogleSignIn(onError);

  useEffect(() => {
    onLoadingChange?.(loading);
  }, [loading, onLoadingChange]);

  const handlePress = async () => {
    if (!isReady) {
      onError('Connexion Google en préparation, réessaie dans un instant.');
      return;
    }
    try {
      await signIn();
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : 'Connexion impossible');
    }
  };

  return (
    <GoogleButton onPress={handlePress} disabled={disabled || loading} loading={loading} />
  );
}
