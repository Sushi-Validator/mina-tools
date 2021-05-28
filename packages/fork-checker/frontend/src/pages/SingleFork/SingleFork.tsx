import React, {
  useMemo,
  useRef
} from "react";
import { useQuery } from "react-query";
import { useParams } from "react-router";
import { Link } from "react-router-dom";
import { forkCheckerApi } from "../../api/fork";

// Fetches a single Fork from the API using forkCheckerApi component
const useForkQuery = (forkId: string) => {
  return useQuery(["fork", forkId], () => forkCheckerApi.getFork(forkId));
};

// Generates a toolbar, specific to the SingleFork page
function SingleForkToolBar() {
  const refresh: React.MutableRefObject<any> = useRef<{ current?: () => void }>();
  return (
  	<div id="SingleFork-Toolbar-Wrapper">
  	  <Link to={"/"} className="Exit-Link">{"<< Go Back"}</Link>
  	  <span className="refreshWrapper" id="SingleFork-Refresh">
        <button onClick={refresh?.current} id="refreshButton"></button>
      </span>
  	</div>
  );
};

// 
function SingleFork() {
  const { forkId } = useParams<{ forkId: string }>();
  const { data } = useForkQuery(forkId);

  const forks = useMemo(() => {
  	const items: React.ReactNode[] = [];
  	if (data) {
  	  const blocksList = JSON.parse(JSON.stringify(data));
  	  const producerCount = new Set(blocksList.blocks.creator).size;
  	  items.push(
  	  	<div className="SingleFork-Wrapper" key={0}>
  	  	  <div className="SingleFork-Title">
  	  	  	<span className="SingleFork-SubTitle">Fork: </span>
  	  	    {forkId}
  	  	  </div>
  	  	  <div className="SingleFork-Blurbs">
  	  	    <div className="Blurb-Header" id="SingleFork-Length">
  	  	      <div className="Blurb-SubNum">{blocksList.length}</div>
  	  	      <div className="Blurb-SubText">Blocks Long</div>
  	  	    </div>
    	  	  <div className="Blurb-Header" id="SingleFork-Producers">
  	  	      <div className="Blurb-SubNum">{producerCount}</div>
  	  	      <div className="Blurb-SubText">Producers</div>
  	  	    </div>
  	  	    <div className="Blurb-Header" id="SingleFork-Rewards">
  	  	      <div className="Blurb-SubNum">{blocksList.rewards}</div>
  	  	      <div className="Blurb-SubText">Missed Rewards</div>
  	  	    </div>
  	  	  </div>
  	  	</div>
  	  );

  	  Object.keys(blocksList.blocks.block).forEach(function(key) {
  	  	const timestamp = new Date(blocksList.blocks.timestamp[key]);
        return items.push(
          <div className="Block-Wrapper" key={key+1}>
            <div className="Block-Timestamp">
              {timestamp.toLocaleDateString("us-EN") +
                " at " +
                timestamp.toLocaleTimeString("us-EN")}
            </div>
          	<div className="Block-Hash">
          	  <span className="Block-Details">Block: </span>
          	  {blocksList.blocks.block[key]}
          	  <a className="Block-Friends" target="_blank" rel="noopener noreferrer"
          	  href={"https://minaexplorer.com/block/" + blocksList.blocks.block[key]}>
              MinaExplorer
              </a>
          	</div>
            <div className="Block-Creator">
              <span className="Block-Details">Creator: </span>
              {blocksList.blocks.creator[key]}
              <a className="Block-Friends" target="_blank" rel="noopener noreferrer"
              href={"https://minaexplorer.com/wallet/" + blocksList.blocks.creator[key]}>
              MinaExplorer
              </a>
              <a className="Block-Friends" target="_blank" rel="noopener noreferrer"
              href={"https://mina.staketab.com/validator/" + blocksList.blocks.creator[key]}>
              StakeTab
              </a>
            </div>
          </div>
        );
      });
  	}
  	return items;
  }, [data, forkId]);

  return <div id="SingleFork-Table">{forks}</div>;
}

function ForkPage() {
  return (
  	<>
  	<SingleForkToolBar />
  	<SingleFork />
  	</>
  );
}

export default ForkPage;
