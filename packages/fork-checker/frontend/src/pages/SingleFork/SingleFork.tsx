import React from "react";
import { useQuery } from "react-query";
import { useParams } from "react-router";
import { forkCheckerApi } from "../../api";

const useForkQuery = (forkId: string) => {
  return useQuery(["fork", forkId], () => forkCheckerApi.getFork(forkId));
};

function SingleFork() {
  const { forkId } = useParams<{ forkId: string }>();
  const { data } = useForkQuery(forkId);

  return (
    <>
      <p>{forkId}</p>
      <pre style={{ textAlign: 'left' }}>{JSON.stringify(data, null, 2)}</pre>
    </>
  );
}

export default SingleFork;
