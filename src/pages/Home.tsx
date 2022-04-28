import { Link } from 'react-router-dom';

const Home = () => {
  return (
    <>
      <div className="flex p-8">
        <div className="p-4 mr-4 bg-white rounded-md shadow-lg">
          <Link to="/video/server">
            <div className="text-xl">Server</div>
          </Link>
        </div>

        <div className="p-4 bg-white rounded-md shadow-lg">
          <Link to="/video/client">
            <div className="text-xl">Client</div>
          </Link>
        </div>
      </div>
    </>
  );
};

export default Home;
