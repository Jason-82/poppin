'use client';

import { useRouter } from 'next/navigation';
import PasscodeForm from '@/components/auth/PasscodeForm';

export default function GatePage() {
  const router = useRouter();

  const handleSuccess = () => {
    router.push('/map');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-900 via-black to-purple-900">
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-10"></div>
      <div className="relative z-10 px-4">
        <PasscodeForm onSuccess={handleSuccess} />
      </div>
    </div>
  );
}
