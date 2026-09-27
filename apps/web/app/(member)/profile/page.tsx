'use client';

import { ApplicationSection } from '@/components/profile/ApplicationSection';
import { ClaimsSection } from '@/components/profile/ClaimsSection';
import { DetailsSection } from '@/components/profile/DetailsSection';
import { CertificatesSection, ExperienceSection, QualificationsSection } from '@/components/profile/EvidenceSections';
import { SkillsSection } from '@/components/profile/SkillsSection';
import { Alert, PageHeader, Spinner } from '@/components/ui';
import { useProfile } from '@/lib/profile';

export default function ProfilePage() {
  const { profile, competencies, error, reload } = useProfile();

  if (error) return <Alert>{error}</Alert>;
  if (!profile) return <Spinner />;

  const isTrainer = profile.role === 'TRAINER';
  return (
    <>
      <PageHeader
        title="Your profile"
        description={isTrainer ? 'Your evidence and competency claims decide how you rank for each subject.' : 'Keep your qualifications, experience and skills up to date.'}
      />
      <div className="space-y-5">
        <DetailsSection profile={profile} onSaved={reload} />
        {isTrainer && <ClaimsSection profile={profile} competencies={competencies} onChanged={reload} />}
        {!isTrainer && <SkillsSection profile={profile} competencies={competencies} onSaved={reload} />}
        <CertificatesSection profile={profile} onChanged={reload} />
        <QualificationsSection profile={profile} onChanged={reload} />
        <ExperienceSection profile={profile} onChanged={reload} />
        {!isTrainer && <ApplicationSection profile={profile} onChanged={reload} />}
      </div>
    </>
  );
}
