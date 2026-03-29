'use client';

import { useState } from 'react';
import { Client } from '@/lib/types';
import { saveClient } from '@/lib/database';

interface ManageAccessProps {
  clientId: string;
  client: Client;
}

export default function ManageAccess({ clientId, client }: ManageAccessProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [localClient, setLocalClient] = useState<Client>(client);

  const handleToggleModule = async (module: 'brand_kit' | 'email_signature') => {
    let updatedModules = [...localClient.activeModules];

    if (module === 'brand_kit') {
      if (updatedModules.includes('brand_kit')) {
        updatedModules = updatedModules.filter((m) => m !== 'brand_kit');
      } else {
        updatedModules.push('brand_kit');
      }
    } else if (module === 'email_signature') {
      if (updatedModules.includes('email_signature')) {
        updatedModules = updatedModules.filter((m) => m !== 'email_signature');
      } else {
        updatedModules.push('email_signature');
      }
    }

    const updated = { ...localClient, activeModules: updatedModules };
    setLocalClient(updated);
    await saveClient(updated);
  };

  const hasBrandKit = localClient.activeModules.includes('brand_kit');
  const hasEmailSig = localClient.activeModules.includes('email_signature');

  return (
    <div style={{ position: 'relative', display: 'inline-block', marginTop: '14px' }} id={`ma-wrap-${clientId}`}>
      <button
        className="ma-btn"
        onClick={() => setIsOpen(!isOpen)}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
        Manage Access
      </button>

      {isOpen && (
        <div
          className="ma-dropdown"
          id={`ma-dd-${clientId}`}
          style={{ display: 'block' }}
        >
          <div className="ma-dd-hd">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Client Access
          </div>

          <div className="client-access-modules">
            <div className={`access-module-pill${hasBrandKit ? ' active' : ''}`}>
              <span className={`access-dot${hasBrandKit ? ' on' : ' off'}`} />
              Brand Kit
              <button
                className="access-toggle-btn"
                onClick={() => handleToggleModule('brand_kit')}
              >
                {hasBrandKit ? 'Revoke' : 'Grant'}
              </button>
            </div>

            <div className={`access-module-pill${hasEmailSig ? ' active' : ''}`}>
              <span className={`access-dot${hasEmailSig ? ' on' : ' off'}`} />
              Email Signature
              <button
                className="access-toggle-btn"
                onClick={() => handleToggleModule('email_signature')}
              >
                {hasEmailSig ? 'Revoke' : 'Grant'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
