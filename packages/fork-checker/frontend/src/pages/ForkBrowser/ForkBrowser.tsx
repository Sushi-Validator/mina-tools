import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQuery } from "react-query";
import { Link } from "react-router-dom";

import { forkCheckerApi } from "../../api";

const TIMEFRAMES = {
  ONE_MINUTE: 1000 * 60,
  ONE_DAY: 1000 * 60 * 60 * 24,
  ONE_WEEK: 1000 * 60 * 60 * 24 * 7,
  ONE_MONTH: 1000 * 60 * 60 * 24 * 30,
  ONE_YEAR: 1000 * 60 * 60 * 24 * 365,
};

const defaultContext = {
  forkQuantity: 5,
  forkTimeFrame: TIMEFRAMES.ONE_WEEK,
  refreshTimer: TIMEFRAMES.ONE_MINUTE / 10,
  incrementForkQuantity: () => {},
};

type ForkBrowserProviderProps = {
  children: React.ReactNode;
};

type ForkBrowserContextShape = {
  forkQuantity: number;
  forkTimeFrame: number;
  refreshTimer: number;
  incrementForkQuantity: () => void;
  decrementForkQuantity: () => void;
  setForkTimeFrame: (value: number) => void;
  setRefreshTimer: (value: number) => void;
  refresh: React.MutableRefObject<any>;
};

const ForkBrowserContext =
  createContext<ForkBrowserContextShape | undefined>(undefined);

export const useForkBrowserContext = () => {
  const context = useContext(ForkBrowserContext);

  if (context === undefined) {
    throw new Error(
      "useForkBrowserContext must be used within a ForkBrowserProvider"
    );
  }
  return context;
};

const ForkBrowserProvider = ({ children }: ForkBrowserProviderProps) => {
  const [forkQuantity, setForkQuantity] = useState(defaultContext.forkQuantity);
  const [forkTimeFrame, setForkTimeFrame] = useState(
    defaultContext.forkTimeFrame
  );
  const [refreshTimer, setRefreshTimer] = useState(defaultContext.refreshTimer);

  const incrementForkQuantity = useCallback(
    () => setForkQuantity(forkQuantity + 1),
    [forkQuantity]
  );
  const decrementForkQuantity = useCallback(
    () => setForkQuantity(forkQuantity - 1),
    [forkQuantity]
  );
  const refresh = useRef<{ current?: () => void }>();

  const contextValue = useMemo(() => {
    return {
      forkQuantity,
      incrementForkQuantity,
      decrementForkQuantity,
      forkTimeFrame,
      setForkTimeFrame,
      refreshTimer,
      setRefreshTimer,
      refresh,
    };
  }, [
    decrementForkQuantity,
    incrementForkQuantity,
    forkQuantity,
    forkTimeFrame,
    refreshTimer,
  ]);

  return (
    <ForkBrowserContext.Provider value={contextValue}>
      {children}
    </ForkBrowserContext.Provider>
  );
};

const timeFrameOptions = [
  {
    value: TIMEFRAMES.ONE_WEEK,
    label: "Week",
  },
  {
    value: TIMEFRAMES.ONE_MONTH,
    label: "Month",
  },
  {
    value: TIMEFRAMES.ONE_YEAR,
    label: "Year",
  },
];

const refreshOptions = [
  {
    value: TIMEFRAMES.ONE_MINUTE,
    label: "1m",
  },
  {
    value: TIMEFRAMES.ONE_MINUTE * 5,
    label: "5m",
  },
  {
    value: TIMEFRAMES.ONE_MINUTE * 10,
    label: "10m",
  },
  {
    value: TIMEFRAMES.ONE_MINUTE * 30,
    label: "30m",
  },
  {
    value: TIMEFRAMES.ONE_MINUTE * 60,
    label: "1h",
  },
];

function ToolBar() {
  const {
    forkQuantity,
    incrementForkQuantity,
    decrementForkQuantity,
    forkTimeFrame,
    setForkTimeFrame,
    refreshTimer,
    setRefreshTimer,
    refresh,
  } = useForkBrowserContext();

  const handleForkTimeFrameSelect = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    setForkTimeFrame(Number(e.target.value));
  };

  const handleRefreshTimerSelect = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    setRefreshTimer(Number(e.target.value));
  };

  return (
    <div id="Toolbar-Wrapper">
      Displaying&nbsp;
      <span className="counterWrapper">
        <button onClick={decrementForkQuantity}>–</button>
        <span id="Fork-Quantity">{forkQuantity}</span>
        <button onClick={incrementForkQuantity}>+</button>
      </span>
      &nbsp;most recent forks from within the past&nbsp;
      <select
        onChange={handleForkTimeFrameSelect}
        id="Fork-Timeframe"
        value={forkTimeFrame}
      >
        {timeFrameOptions.map(({ value, label }) => (
          <option className="option" value={value} key={value}>
            {label}
          </option>
        ))}
      </select>
      <span className="refreshWrapper">
        <button onClick={refresh?.current} id="refreshButton"></button>
      </span>
      <select
        onChange={handleRefreshTimerSelect}
        id="refreshTimer"
        value={refreshTimer}
      >
        {refreshOptions.map(({ value, label }) => (
          <option className="option" value={value} key={value}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}

const useForksQuery = (timeFrame: number, refreshTimer: number) => {
  return useQuery(
    ["forks", timeFrame],
    async () => {
      return await forkCheckerApi.getForks(timeFrame);
    },
    {
      refetchInterval: Number(refreshTimer),
    }
  );
};

function ForkTable() {
  const { forkTimeFrame, refreshTimer, refresh, forkQuantity } =
    useForkBrowserContext();
  const { data, refetch } = useForksQuery(forkTimeFrame, refreshTimer);

  useEffect(() => {
    refresh.current = refetch;
  }, [refresh, refetch]);

  const forks = useMemo(() => {
    const items: React.ReactNode[] = [];

    if (data) {
      data.every((singleFork: any, index: number) => {
        if (index + 1 > forkQuantity) {
          return false;
        }
        const { last_updated, id, latest, length, rewards } = singleFork;
        const timestamp = new Date(last_updated);

        return items.push(
          <div className="Fork-Wrapper" key={index}>
            <div className="Fork-Timestamp">
              {timestamp.toLocaleDateString("us-EN") +
                " at " +
                timestamp.toLocaleTimeString("us-EN")}
            </div>
            <div className="Fork-Links">
              <Link to={`/fork/${id}`}>{latest}</Link>
            </div>
            <div className="Fork-Details">
              {length + " blocks long, with " + rewards + " MINA lost."}
            </div>
          </div>
        );
      });
    }

    return items;
  }, [data, forkQuantity]);

  return <div id="Fork-Table">{forks}</div>;
}

function ForkBrowser() {
  return (
    <ForkBrowserProvider>
      <ToolBar />
      <ForkTable />
    </ForkBrowserProvider>
  );
}

export default ForkBrowser;
