'use client';

import styles from './InstallGuide.module.css';

interface InstallGuideProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const GUIDES = {
  gmail: {
    steps: [
      'Open Gmail → click the gear icon (top right) → See all settings',
      'Under the General tab, scroll to Signature',
      'Click + Create new and name it',
      'Click the </> source icon in the signature editor',
      'Paste your HTML and click OK',
      'Scroll down and click Save Changes',
    ],
    note: '',
  },
  outlook: {
    steps: [
      'Open Outlook → File → Options → Mail → Signatures',
      'Click New and name your signature',
      'In the editor, click the HTML icon or use Insert → Signature',
      'Paste your copied HTML',
      'Set as default for New Messages if desired',
      'Click OK',
    ],
    note: '',
  },
  apple: {
    steps: [
      'Open the downloaded .html file in your browser',
      'Select all (Cmd+A) and copy',
      'Open Mail → Preferences → Signatures',
      'Create a new signature and delete the placeholder text',
      'Paste — it will render as formatted HTML',
    ],
    note: 'Images may not display until you send a test email.',
  },
  mobile: {
    steps: [
      'iPhone/iPad Mail: Go to Settings → Mail → Signature → paste your copied signature',
      'Gmail mobile: Signatures are managed at mail.google.com on desktop',
    ],
    note: 'Formatting may be simplified on mobile devices.',
  },
};

const TAB_LABELS: Record<string, string> = {
  gmail: 'Gmail',
  outlook: 'Outlook',
  apple: 'Apple Mail',
  mobile: 'Mobile',
};

export default function InstallGuide({ activeTab, onTabChange }: InstallGuideProps) {
  const guide = GUIDES[activeTab as keyof typeof GUIDES] || GUIDES.gmail;

  return (
    <div className={styles.guide}>
      <div className={styles.tabs}>
        {Object.entries(TAB_LABELS).map(([key, label]) => (
          <button
            key={key}
            className={`${styles.tab} ${activeTab === key ? styles.active : ''}`}
            onClick={() => onTabChange(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={styles.body}>
        <ol className={styles.stepsList}>
          {guide.steps.map((step, idx) => (
            <li key={idx} dangerouslySetInnerHTML={{ __html: step }} />
          ))}
        </ol>
        {guide.note && (
          <div className={styles.note} dangerouslySetInnerHTML={{ __html: guide.note }} />
        )}
      </div>
    </div>
  );
}
