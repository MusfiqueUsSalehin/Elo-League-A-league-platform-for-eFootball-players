import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Alert, Avatar, Button, Spinner, StatTile, TextField } from './index.jsx';

describe('TextField', () => {
  it('connects the label to the input', () => {
    render(<TextField label="Username" />);
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
  });

  it('describes the input with its hint and error', () => {
    render(<TextField label="Password" hint="At least 10 characters" error="Too short" />);
    const input = screen.getByLabelText('Password');

    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Too short At least 10 characters');
  });

  it('is not marked invalid without an error', () => {
    render(<TextField label="Password" />);
    expect(screen.getByLabelText('Password')).not.toHaveAttribute('aria-invalid');
  });

  it('passes other props through to the input', () => {
    render(<TextField label="Email" type="email" autoComplete="email" required />);
    const input = screen.getByLabelText('Email');

    expect(input).toHaveAttribute('type', 'email');
    expect(input).toHaveAttribute('autocomplete', 'email');
    expect(input).toBeRequired();
  });

  it('gives every field its own id', () => {
    render(
      <>
        <TextField label="First" />
        <TextField label="Second" />
      </>
    );
    expect(screen.getByLabelText('First').id).not.toBe(screen.getByLabelText('Second').id);
  });
});

describe('Button', () => {
  it('runs its click handler', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not submit a form unless asked to', () => {
    render(<Button>Plain</Button>);
    expect(screen.getByRole('button', { name: 'Plain' })).toHaveAttribute('type', 'button');
  });

  it('is disabled and busy while loading', async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>
    );
    const button = screen.getByRole('button', { name: 'Save' });

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('can render as another element', () => {
    render(
      <Button as="a" href="/somewhere">
        Go
      </Button>
    );
    expect(screen.getByRole('link', { name: 'Go' })).toHaveAttribute('href', '/somewhere');
  });
});

describe('Alert', () => {
  it('announces errors immediately', () => {
    render(<Alert tone="error">Wrong password</Alert>);
    expect(screen.getByRole('alert')).toHaveTextContent('Wrong password');
  });

  it('announces other tones politely', () => {
    render(<Alert tone="success">Saved</Alert>);
    expect(screen.getByRole('status')).toHaveTextContent('Saved');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('Spinner', () => {
  it('has a text label for screen readers', () => {
    render(<Spinner label="Loading matches" />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading matches');
  });
});

describe('Avatar', () => {
  it('shows up to two initials and hides them from screen readers', () => {
    const { container } = render(<Avatar name="Musfique Us Salehin" />);
    const avatar = container.firstChild;

    expect(avatar).toHaveTextContent('MU');
    expect(avatar).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('StatTile', () => {
  it('shows the label, value and note', () => {
    render(<StatTile label="Rating" value={1200} sub="Peak 1250" />);

    expect(screen.getByText('Rating')).toBeInTheDocument();
    expect(screen.getByText('1200')).toBeInTheDocument();
    expect(screen.getByText('Peak 1250')).toBeInTheDocument();
  });
});
