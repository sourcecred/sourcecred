// @flow
import React, {useState, useEffect} from "react";
import {Explorer} from "./Explorer";
import {load, type LoadResult} from "../../load";

const App = () => {
  const [loadResult: LoadResult | null, setLoadResult] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      const loadResult = await load();
      setLoadResult(loadResult);
    };

    fetchData();
  }, []);

  if (loadResult == null) {
    return <h1>Loading...</h1>;
  }
  switch (loadResult.type) {
    case "FAILURE":
      return (
        <div>
          <h1>Load Failure</h1>
          <p>Check console for details.</p>
        </div>
      );
    case "SUCCESS":
      return <Explorer initialView={loadResult.credView} />;
    default:
      throw new Error((loadResult.type: empty));
  }
};

export default App;
