import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { escapeHtml, renderEmail } from '../src/services/emailTemplate.js';

const base = { appName: 'Elo League', clientUrl: 'http://localhost:5173', title: 'Match ready' };

describe('escapeHtml', () => {
  it('escapes the characters that matter in HTML', () => {
    assert.equal(
      escapeHtml(`<a href="x">Tom & 'Jerry'</a>`),
      '&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/a&gt;'
    );
  });

  it('turns missing values into an empty string', () => {
    assert.equal(escapeHtml(undefined), '');
    assert.equal(escapeHtml(null), '');
  });
});

describe('renderEmail', () => {
  it('builds a subject, HTML and plain text', () => {
    const email = renderEmail({ ...base, body: 'Your match starts soon.', link: '/matches/42' });

    assert.equal(email.subject, 'Match ready');
    assert.match(email.html, /<h1[^>]*>Match ready<\/h1>/);
    assert.match(email.html, /Your match starts soon\./);
    assert.match(email.html, /href="http:\/\/localhost:5173\/matches\/42"/);
    assert.match(
      email.text,
      /^Match ready\n\nYour match starts soon\.\n\nhttp:\/\/localhost:5173\/matches\/42/
    );
  });

  it('escapes every value that comes from a person', () => {
    const email = renderEmail({
      appName: '<b>League</b>',
      clientUrl: 'http://localhost:5173',
      title: '<script>alert(1)</script>',
      body: 'Hi "friend" & <img src=x onerror=alert(2)>',
      link: '/a?x="1"&y=<2>',
    });

    assert.ok(!email.html.includes('<script>'));
    assert.ok(!email.html.includes('<img'));
    assert.ok(!email.html.includes('<b>League'));
    assert.match(email.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.match(email.html, /&amp;/);
    assert.ok(!email.html.includes('href="http://localhost:5173/a?x="1"'));
  });

  it('keeps line breaks in the body', () => {
    const email = renderEmail({ ...base, body: 'Line one\nLine two' });
    assert.match(email.html, /Line one<br \/>Line two/);
  });

  it('never lets a title add mail headers', () => {
    const email = renderEmail({ ...base, title: 'Hello\r\nBcc: someone@example.com' });
    assert.equal(email.subject, 'Hello Bcc: someone@example.com');
  });

  it('shortens a very long subject', () => {
    assert.equal(renderEmail({ ...base, title: 'x'.repeat(500) }).subject.length, 200);
  });

  it('only links to places inside the app', () => {
    for (const link of [
      'https://evil.example/x',
      '//evil.example/x',
      'javascript:alert(1)',
      'matches/1',
    ]) {
      const email = renderEmail({ ...base, link });
      assert.ok(!email.html.includes('<a '), link);
      assert.ok(!email.text.includes('evil'), link);
    }
  });

  it('leaves out the body and button when there are none', () => {
    const email = renderEmail(base);

    assert.ok(!email.html.includes('<a '));
    assert.ok(!email.html.includes('line-height:1.5'));
    assert.ok(email.text.startsWith('Match ready'));
  });
});
