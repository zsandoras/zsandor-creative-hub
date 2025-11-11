import { useState, useEffect } from "react";

interface PlaylistTrack {
  id: string;
  title: string;
  artist: string | null;
}

export const usePlaylist = () => {
  const [playlist, setPlaylist] = useState<PlaylistTrack[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem("playlist");
    if (stored) {
      setPlaylist(JSON.parse(stored));
    }
  }, []);

  const addToPlaylist = (track: PlaylistTrack) => {
    const exists = playlist.find((t) => t.id === track.id);
    if (!exists) {
      const newPlaylist = [...playlist, track];
      setPlaylist(newPlaylist);
      localStorage.setItem("playlist", JSON.stringify(newPlaylist));
    }
  };

  const removeFromPlaylist = (trackId: string) => {
    const newPlaylist = playlist.filter((t) => t.id !== trackId);
    setPlaylist(newPlaylist);
    localStorage.setItem("playlist", JSON.stringify(newPlaylist));
  };

  const clearPlaylist = () => {
    setPlaylist([]);
    localStorage.removeItem("playlist");
  };

  return { playlist, addToPlaylist, removeFromPlaylist, clearPlaylist };
};
