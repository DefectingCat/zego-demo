import { Link } from 'react-router-dom';

const Home = () => {
  return (
    <>
      <div className="p-8 flex">
        <div className="p-4 bg-white shadow-lg rounded-md  mr-4">
          <Link to="/video/server">
            <h1 className="text-xl">Server</h1>
          </Link>
        </div>

        <div className="p-4 bg-white shadow-lg rounded-md">
          <Link to="/video/client">
            <h1 className="text-xl">Client</h1>
          </Link>
        </div>
      </div>
    </>
  );
};

export default Home;
