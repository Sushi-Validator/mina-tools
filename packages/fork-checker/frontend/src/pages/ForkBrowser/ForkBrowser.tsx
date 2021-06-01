import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTable, /*useSortBy, usePagination*/ } from 'react-table';
import { useQuery } from "react-query";
//import { Link } from "react-router-dom";

import { forkCheckerApi } from "../../api/fork";
import { explorerApi } from "../../api/explorer";

// CONTEXT

const TIMEFRAMES = {
  ONE_MINUTE: 1000 * 60,
  ONE_DAY: 1000 * 60 * 60 * 24,
  ONE_WEEK: 1000 * 60 * 60 * 24 * 7,
  ONE_MONTH: 1000 * 60 * 60 * 24 * 30,
  ONE_YEAR: 1000 * 60 * 60 * 24 * 365,
};

const defaultContext = {
  forkQuantity: 10,
  forkTimeFrame: TIMEFRAMES.ONE_MONTH,
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

// TOOLBAR

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

const useSummaryQuery = () => {
  return useQuery([], () => explorerApi.getSummary());
}

// BLURBS

function ForkBlurbs() {
  const summary = useSummaryQuery();

  const blurbs = useMemo(() => {
    const items: React.ReactNode[] = [];
    if (summary) {
      const sum = JSON.parse(JSON.stringify(summary)).data;
      if (sum) {
        items.push(
          <div className="Summary-Wrapper" key={0}>
            <div className="Summary-Blurbs">
              <div className="Blurb-Header" id="Summary-Length">
                <div className="Blurb-SubNum">{Number(sum.blockchainLength).toLocaleString()}</div>
                <div className="Blurb-SubText">Blockchain Length</div>
              </div>
              <div className="Blurb-Header" id="Summary-Epoch">
                <div className="Blurb-SubNum">{sum.epoch}</div>
                <div className="Blurb-SubText">Current Epoch</div>
              </div>
              <div className="Blurb-Header" id="Summary-Currency">
                <div className="Blurb-SubNum">{Number(sum.totalCurrency.split('./[1-9]/')[0]).toLocaleString()}</div>
                <div className="Blurb-SubText">Total Currency</div>
              </div>
              <div className="Blurb-Header" id="Summary-Locked">
                <div className="Blurb-SubNum">{Number(sum.lockedSupply.split('./[1-9]/')[0]).toLocaleString()}</div>
                <div className="Blurb-SubText">Locked Supply</div>
              </div>
            </div>
          </div>
        );
      }
    }
    return items;
  }, [summary]);
  return <div id="Summary-Blurbs">{blurbs}</div>
}

// TABLE

// TODO: Determine why usePagination and useSortBy are causing React to exceed maximum update depth, then impliment them 

function BuildForkTable(data: {}[]) {

  const tableColumns = useMemo(() => [
    {
      Header: 'Date',
      accessor: 'last_updated',
      //Cell: ({ value }) => value.toLocaleDateString("us-EN")
    },
    {
      Header: 'Fork Length',
      accessor: 'length'
    },
    {
      Header: 'Latest Block',
      accessor: 'latest',
      //Cell: ({ row }) => (<Link to={{ pathname: `/fork/${row.id}` }}>{row.latest}</Link>)
    },
    {
      Header: 'Unrealized Rewards',
      accessor: 'rewards'
    }
  ],[])

  const 
  {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow,
  } = useTable ({
    columns: tableColumns,
    data
  },
  //usePagination
  //useSortBy
  )

  return (
    <>
      <div className="ForkTable">
        <table {...getTableProps()}>
          <thead>
            {headerGroups.map((headerGroup, index) => (
              <tr {...headerGroup.getHeaderProps} key={index}>
                {headerGroup.headers.map(column => (
                  <th {...column.getHeaderProps(/*column.getSortByToggleProps()*/)}>
                    {column.render('Header')}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody {...getTableBodyProps()}>
            {rows.map(row => {
              prepareRow(row)
              return (
                <tr {...row.getRowProps()}>
                  {row.cells.map(cell => {
                    return <td {...cell.getCellProps()}>{cell.render('Cell')}</td>
                  })}
                </tr>
            )})}
          </tbody>
        </table>
      </div>
    </>
  );
}


function ForkTable() {
  const { forkTimeFrame, refreshTimer } =
    useForkBrowserContext();
  const { data } = useForksQuery(forkTimeFrame, refreshTimer);
  // Temp data - displays an empty table while waiting for the axios response to finish
  const data_empty = [{
    'last_updated': '',
    'length': '',
    'latest': '',
    'rewards': ''
  }]

  if (data) {
      const data_json = JSON.parse(JSON.stringify(data));
      return BuildForkTable(data_json);
    }
    return BuildForkTable(data_empty);
}

function ForkBrowser() {
  return (
    <ForkBrowserProvider>
      <ToolBar />
      <ForkBlurbs />
      <ForkTable />
    </ForkBrowserProvider>
  );
}

export default ForkBrowser;
