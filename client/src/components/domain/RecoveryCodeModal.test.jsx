import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RecoveryCodeModal from './RecoveryCodeModal.jsx';

const CODE = 'ABCDE-FGHJK-MNPQR-STVWX';

beforeEach(() => {
  window.print = vi.fn();
  URL.createObjectURL = vi.fn(() => 'blob:relancepro');
  URL.revokeObjectURL = vi.fn();
});

describe('RecoveryCodeModal', () => {
  it('affiche le code, permet de le copier et exige une confirmation explicite', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);

    render(<RecoveryCodeModal code={CODE} email="awa@example.com" onConfirm={onConfirm} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(CODE)).toBeInTheDocument();

    const confirm = screen.getByRole('button', {
      name: /enregistré mon code, continuer/i,
    });
    expect(confirm).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /copier/i }));
    expect(writeText).toHaveBeenCalledWith(CODE);
    expect(await screen.findByText('Copié')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /imprimer/i }));
    expect(window.print).toHaveBeenCalled();

    await user.click(screen.getByRole('checkbox'));
    expect(confirm).toBeEnabled();

    await user.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
