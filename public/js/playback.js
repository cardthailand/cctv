function openPlayback({ fileName, channel, seekSeconds = 0 }) {
  const modal = document.getElementById('playback-modal');
  const video = document.getElementById('playback-video');
  const title = document.getElementById('playback-title');

  title.textContent = `Channel ${channel} - ${fileName}`;
  video.src = `/api/recordings/file/${encodeURIComponent(fileName)}`;
  modal.classList.add('open');

  const onLoaded = () => {
    if (seekSeconds > 0) {
      video.currentTime = seekSeconds;
    }
    video.removeEventListener('loadedmetadata', onLoaded);
  };
  video.addEventListener('loadedmetadata', onLoaded);
  video.play().catch(() => {});
}

function closePlayback() {
  const modal = document.getElementById('playback-modal');
  const video = document.getElementById('playback-video');
  video.pause();
  video.removeAttribute('src');
  video.load();
  modal.classList.remove('open');
}
