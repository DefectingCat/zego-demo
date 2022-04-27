import { Outlet } from 'react-router-dom';

const Video = () => {
  return (
    <>
      <div>tabbar</div>

      <div>
        <Outlet />
      </div>
    </>
  );
};

export default Video;
