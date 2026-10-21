import { CheckCheck } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../api/client.js';
import EmailPreferences from '../components/notifications/EmailPreferences.jsx';
import Pagination from '../components/Pagination.jsx';
import { Alert, Badge, Button, Card, Spinner, cx } from '../components/ui/index.jsx';
import { useUnread } from '../context/UnreadContext.jsx';
import { useList } from '../hooks/useList.js';
import { usePageTitle } from '../hooks/usePageTitle.js';
import { timeAgo, typeLabel } from '../lib/notifications.js';

const PAGE_SIZE = 20;

function FilterButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        'rounded-lg px-3 py-1.5 text-sm transition-colors',
        active ? 'bg-turf-600 text-chalk' : 'text-mist hover:text-chalk'
      )}
    >
      {children}
    </button>
  );
}

function NotificationItem({ item, onOpen }) {
  const unread = !item.readAt;
  const content = (
    <span className="flex items-start gap-3">
      <span
        aria-hidden="true"
        className={cx(
          'mt-1.5 h-2 w-2 shrink-0 rounded-full',
          unread ? 'bg-flood' : 'bg-transparent'
        )}
      />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className={cx('text-sm', unread ? 'font-semibold' : 'font-medium text-chalk/90')}>
            {item.title}
          </span>
          <Badge>{typeLabel(item.type)}</Badge>
          {unread && <span className="sr-only">Unread</span>}
        </span>
        {item.body && <span className="mt-0.5 block text-sm text-mist">{item.body}</span>}
        <span className="mt-1 block text-xs text-mist/80">{timeAgo(item.createdAt)}</span>
      </span>
    </span>
  );

  // Something already read and going nowhere has nothing left to do, so it is not a button.
  if (!unread && !item.link) return <div className="px-3 py-3">{content}</div>;

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="block w-full rounded-lg px-3 py-3 text-left transition-colors hover:bg-turf-700/60"
    >
      {content}
    </button>
  );
}

export default function Notifications() {
  usePageTitle('Notifications');
  const navigate = useNavigate();
  const { refresh } = useUnread();
  const [filters, setFilters] = useState({ unreadOnly: false, page: 1 });
  const [actionError, setActionError] = useState('');

  const { status, data, error, reload } = useList('/notifications', {
    unread: filters.unreadOnly ? 'true' : '',
    page: filters.page,
    limit: PAGE_SIZE,
  });

  const items = data?.items ?? [];
  const setUnreadOnly = (unreadOnly) => setFilters({ unreadOnly, page: 1 });

  const open = async (item) => {
    setActionError('');
    try {
      if (!item.readAt) await api.post(`/notifications/${item._id}/read`);
      refresh();
      if (item.link) navigate(item.link);
      else reload();
    } catch (err) {
      setActionError(err.message);
    }
  };

  const markAllRead = async () => {
    setActionError('');
    try {
      await api.post('/notifications/read-all');
      refresh();
      reload();
    } catch (err) {
      setActionError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl leading-none">Notifications</h1>
          <p className="mt-2 text-sm text-mist">What has happened in your league.</p>
        </div>
        <Button variant="ghost" onClick={markAllRead} disabled={!data || data.unread === 0}>
          <CheckCheck size={16} aria-hidden="true" />
          Mark all as read
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="space-y-4">
          <div
            role="group"
            aria-label="Which notifications"
            className="flex w-fit rounded-xl border border-line p-1"
          >
            <FilterButton active={!filters.unreadOnly} onClick={() => setUnreadOnly(false)}>
              All
            </FilterButton>
            <FilterButton active={filters.unreadOnly} onClick={() => setUnreadOnly(true)}>
              Unread only
            </FilterButton>
          </div>

          {(actionError || status === 'error') && (
            <Alert tone="error">
              <p>{actionError || error}</p>
              {status === 'error' && (
                <Button variant="link" className="mt-1" onClick={reload}>
                  Try again
                </Button>
              )}
            </Alert>
          )}

          {status === 'loading' && !data && <Spinner label="Loading notifications" />}

          {data &&
            (items.length === 0 ? (
              <Card className="px-6 py-10 text-center text-sm text-mist">
                {filters.unreadOnly ? 'You are all caught up.' : 'No notifications yet.'}
              </Card>
            ) : (
              <div className="space-y-4">
                <Card className="p-1">
                  <ul className="divide-y divide-line">
                    {items.map((item) => (
                      <li key={item._id}>
                        <NotificationItem item={item} onOpen={open} />
                      </li>
                    ))}
                  </ul>
                </Card>
                <Pagination
                  page={data.page}
                  pages={data.pages}
                  total={data.total}
                  pageSize={PAGE_SIZE}
                  onChange={(page) => setFilters({ ...filters, page })}
                />
              </div>
            ))}
        </div>

        <EmailPreferences />
      </div>
    </div>
  );
}
