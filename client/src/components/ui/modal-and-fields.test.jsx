import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Badge, Modal, SelectField } from './index.jsx';

describe('SelectField', () => {
  it('connects the label and the error to the select', () => {
    render(
      <SelectField label="Platform" error="Pick one">
        <option value="PS5">PS5</option>
      </SelectField>
    );
    const select = screen.getByLabelText('Platform');

    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(select).toHaveAccessibleDescription('Pick one');
  });
});

describe('Badge', () => {
  it('shows its text', () => {
    render(<Badge tone="green">Active</Badge>);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });
});

describe('Modal', () => {
  it('shows nothing while closed', () => {
    render(
      <Modal open={false} onClose={() => {}} title="Add a player">
        <p>Form</p>
      </Modal>
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('Form')).not.toBeInTheDocument();
  });

  it('opens as a dialog named by its title and described by its description', () => {
    render(
      <Modal open onClose={() => {}} title="Add a player" description="Fill in the details">
        <p>Form</p>
      </Modal>
    );
    const dialog = screen.getByRole('dialog', { name: 'Add a player' });

    expect(dialog).toHaveAccessibleDescription('Fill in the details');
    expect(screen.getByText('Form')).toBeInTheDocument();
  });

  it('closes from the close button', async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Add a player">
        <p>Form</p>
      </Modal>
    );

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when the backdrop is clicked but not when the content is', async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Add a player">
        <p>Form</p>
      </Modal>
    );

    await userEvent.click(screen.getByText('Form'));
    expect(onClose).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when a drag that began inside the dialog ends on the backdrop', () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Add a player">
        <input aria-label="Name" />
      </Modal>
    );

    fireEvent.mouseDown(screen.getByLabelText('Name'));
    fireEvent.click(screen.getByRole('dialog'));

    expect(onClose).not.toHaveBeenCalled();
  });

  it('asks the page to close on Escape instead of closing itself', () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Add a player">
        <p>Form</p>
      </Modal>
    );

    const cancel = new Event('cancel', { cancelable: true });
    fireEvent(screen.getByRole('dialog'), cancel);

    expect(cancel.defaultPrevented).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('hides again when open turns false', () => {
    const { rerender } = render(
      <Modal open onClose={() => {}} title="Add a player">
        <p>Form</p>
      </Modal>
    );
    rerender(
      <Modal open={false} onClose={() => {}} title="Add a player">
        <p>Form</p>
      </Modal>
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
