import { Component } from 'react';
import { Button } from './ui/index.jsx';

/**
 * Catches errors thrown while rendering so one broken screen cannot leave a blank page.
 * It cannot catch errors in event handlers or async code; those are handled where they occur.
 */
export default class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error('Unhandled interface error', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <main role="alert" className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-sm space-y-4 text-center">
          <h1 className="font-display text-4xl leading-none">Something went wrong</h1>
          <p className="text-sm text-mist">
            The page hit an unexpected problem. Reloading usually fixes it.
          </p>
          <Button onClick={() => window.location.reload()}>Reload the page</Button>
        </div>
      </main>
    );
  }
}
