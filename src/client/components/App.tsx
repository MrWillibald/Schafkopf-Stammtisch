import { useEffect, useState } from 'react';
import { CardGallery } from './CardFace';
import { OFFLINE } from '../socket';
import { Home } from './Home';
import { OfflineApp } from './OfflineApp';
import { RoomPage } from './RoomPage';

function currentRoomId(): string | null {
  const m = window.location.pathname.match(/^\/r\/([a-z0-9]+)\/?$/);
  return m ? m[1] : null;
}

export function navigate(path: string) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function App() {
  const [roomId, setRoomId] = useState(currentRoomId);
  useEffect(() => {
    const onPop = () => setRoomId(currentRoomId());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  if (OFFLINE) return <OfflineApp />;
  if (window.location.pathname === '/karten') return <CardGallery />;
  return roomId ? <RoomPage key={roomId} roomId={roomId} /> : <Home />;
}
