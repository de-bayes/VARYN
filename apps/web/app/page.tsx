'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LandingRedirect() {
  const router = useRouter();

  useEffect(() => {
    const hasSkillLevel = localStorage.getItem('varyn_skill_level');
    if (hasSkillLevel) {
      router.replace('/workspace');
    } else {
      router.replace('/onboarding');
    }
  }, [router]);

  return null;
}
