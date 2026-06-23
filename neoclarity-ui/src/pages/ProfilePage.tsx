import { authApi, accountApi } from '../api/services';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { Card, SectionTitle, Badge, Btn, Spinner, fmt, C } from '../components/ui';

export function ProfilePage() {
  const { customer, login } = useAuth();
  const { data: accounts, loading } = useApi(accountApi.list);

  const toggleConsent = async () => {
    if (!customer) return;
    const updated = await authApi.updateConsent(!customer.consentActive);
    login(localStorage.getItem('nc_token')!, updated);
  };

  const CONTEXT_LABELS = [
    { label: 'PARENT',        display: 'Parent',        icon: '👨‍👩‍👧' },
    { label: 'HOMEOWNER',     display: 'Homeowner',     icon: '🏠' },
    { label: 'MARRIED',       display: 'Married',       icon: '💍' },
    { label: 'SELF_EMPLOYED', display: 'Self-Employed', icon: '💼' },
    { label: 'CAREGIVER',     display: 'Caregiver',     icon: '❤️' },
  ];

  // For demo, we show static confirmed context based on seeded data
  const confirmedLabels = ['PARENT', 'HOMEOWNER', 'MARRIED'];

  const acctIcons: Record<string, string> = {
    CHECKING: '🏦', SAVINGS: '💰', CREDIT: '💳', LOAN: '📋',
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

      {/* LEFT */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Card>
          <SectionTitle>My Context</SectionTitle>
          <p style={{ fontSize: 12, color: C.gray600, marginTop: 0, marginBottom: 14 }}>
            Confirming your life context improves coaching relevance.
          </p>
          {CONTEXT_LABELS.map(({ label, display, icon }) => {
            const confirmed = confirmedLabels.includes(label);
            return (
              <div key={label} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 0', borderBottom: `1px solid ${C.gray100}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{icon}</span>
                  <span style={{ fontSize: 13, color: C.gray800, fontWeight: confirmed ? 600 : 400 }}>
                    {display}
                  </span>
                </div>
                <Badge
                  label={confirmed ? 'Confirmed' : 'Add'}
                  color={confirmed ? C.teal : C.accent}
                  bg={confirmed ? C.tealBg : C.lightBg}
                />
              </div>
            );
          })}
        </Card>

        {customer && (
          <Card>
            <SectionTitle>Account Info</SectionTitle>
            <div style={{ fontSize: 13, color: C.gray800, marginBottom: 6 }}>
              <strong>{customer.firstName} {customer.lastName}</strong>
            </div>
            <div style={{ fontSize: 13, color: C.gray600 }}>{customer.email}</div>
          </Card>
        )}
      </div>

      {/* RIGHT */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Card>
          <SectionTitle>Connected Accounts</SectionTitle>
          {loading ? <Spinner /> : accounts?.map(a => (
            <div key={a.accountId} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 0', borderBottom: `1px solid ${C.gray100}`,
            }}>
              <span style={{ fontSize: 20 }}>{acctIcons[a.accountType] ?? '🏦'}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.gray800 }}>{a.institution}</div>
                <div style={{ fontSize: 11, color: C.gray400 }}>{a.accountType}</div>
              </div>
              <Badge label="Connected" color={C.teal} bg={C.tealBg} />
            </div>
          ))}
          <div style={{ marginTop: 12 }}>
            <Btn label="+ Link another account" variant="secondary" small />
          </div>
        </Card>

        <Card>
          <SectionTitle>Consent Management</SectionTitle>
          <p style={{ fontSize: 13, color: C.gray600, lineHeight: 1.6, marginTop: 0 }}>
            You control whether NeoClarity may process your financial data for coaching purposes.
          </p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
            <span style={{ fontSize: 13, color: C.gray800 }}>Data processing</span>
            <Badge
              label={customer?.consentActive ? 'Active' : 'Revoked'}
              color={customer?.consentActive ? C.teal : C.red}
              bg={customer?.consentActive ? C.tealBg : '#FEE2E2'}
            />
          </div>
          <div style={{ marginTop: 14 }}>
            <Btn
              label={customer?.consentActive ? 'Revoke Consent' : 'Grant Consent'}
              variant={customer?.consentActive ? 'danger' : 'success'}
              small
              onClick={toggleConsent}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
