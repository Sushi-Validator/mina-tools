import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTable, useSortBy, usePagination, Column } from "react-table";
import { useQuery } from "react-query";
import { Link } from "react-router-dom";

import { forkCheckerApi } from "../../api/fork";
import { explorerApi } from "../../api/explorer";
import { Fork } from "../../api/fork/forkCheckerApi";

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

interface ForkTableData extends Fork {
  updatedDate: string;
  rewardString: string;
}

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
    //forkQuantity,
    //incrementForkQuantity,
    //decrementForkQuantity,
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
      Displaying forks from within the past&nbsp;
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
};

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
                <div className="Blurb-SubNum">
                  {Number(sum.blockchainLength).toLocaleString()}
                </div>
                <div className="Blurb-SubText">Blockchain Length</div>
              </div>
              <div className="Blurb-Header" id="Summary-Slot">
                <div className="Blurb-SubNum">
                  {Number(sum.globalSlot).toLocaleString()}
                </div>
                <div className="Blurb-SubText">Current Slot</div>
              </div>
              <div className="Blurb-Header" id="Summary-Epoch">
                <div className="Blurb-SubNum">{sum.epoch}</div>
                <div className="Blurb-SubText">Current Epoch</div>
              </div>
              <div className="Blurb-Header" id="Summary-Currency">
                <div className="Blurb-SubNum">
                  {Number(
                    sum.totalCurrency.split("./[1-9]/")[0]
                  ).toLocaleString()}
                </div>
                <div className="Blurb-SubText">Total Currency</div>
              </div>
              <div className="Blurb-Header" id="Summary-Locked">
                <div className="Blurb-SubNum">
                  {Number(
                    sum.lockedSupply.split("./[1-9]/")[0]
                  ).toLocaleString()}
                </div>
                <div className="Blurb-SubText">Locked Supply</div>
              </div>
            </div>
          </div>
        );
      }
    }
    return items;
  }, [summary]);
  return <div id="Summary-Blurbs">{blurbs}</div>;
}

const formatLastUpdated = (value: number): string => {
  const timestamp = new Date(value);

  return `${timestamp.toLocaleDateString()} ${timestamp.toLocaleTimeString()}`;
};

// TABLE

// TODO: Determine why usePagination and useSortBy are causing React to exceed maximum update depth, then impliment them

function ForkTable({ data }: { data: Fork[] }) {
  const tableData = useMemo<ForkTableData[]>(() => {
    return data.map((singleFork) => ({
      ...singleFork,
      updatedDate: formatLastUpdated(singleFork.last_updated),
      rewardString:
        singleFork.rewards > 0
          ? Number(singleFork.rewards).toLocaleString()
          : "",
    }));
  }, [data]);

  const tableColumns = useMemo<Column<ForkTableData>[]>(
    () => [
      {
        Header: "Date",
        accessor: "updatedDate",
      },
      {
        Header: "Fork Length",
        accessor: "length",
      },
      {
        Header: "Fork ID",
        accessor: "id",
        Cell: (row: any) => (
          <Link to={{ pathname: `/fork/${row.value}` }}>{row.value}</Link>
        ),
      },
      {
        Header: "Unrealized Rewards ",
        accessor: "rewardString",
      },
    ],
    []
  );

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    page,
    nextPage,
    previousPage,
    canNextPage,
    canPreviousPage,
    pageOptions,
    setPageSize,
    state,
    prepareRow,
  } = useTable(
    {
      columns: tableColumns,
      data: tableData,
      initialState: { pageIndex: 0 },
    },
    useSortBy,
    usePagination
  );

  const { pageIndex, pageSize } = state;

  return (
    <>
      <div className="ForkTable">
        <table {...getTableProps()}>
          <thead>
            {headerGroups.map((headerGroup, index) => (
              <tr {...headerGroup.getHeaderProps} key={index}>
                {headerGroup.headers.map((column) => (
                  <th {...column.getHeaderProps(column.getSortByToggleProps())}>
                    {column.render("Header")}
                    <span>
                      {
                        column.isSorted
                          ? column.isSortedDesc
                            ? " ⏷"
                            : " ⏶"
                          : " ⠀" /* This last one is unicode character U+2800, not a space */
                      }
                    </span>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody {...getTableBodyProps()}>
            {page.map((row) => {
              prepareRow(row);
              return (
                <tr {...row.getRowProps()}>
                  {row.cells.map((cell) => {
                    return (
                      <td {...cell.getCellProps()}>{cell.render("Cell")}</td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="TableFooter">
          <span className="TableNav">
            <button onClick={() => previousPage()} disabled={!canPreviousPage}>
              {"<<"}
            </button>
            <span>
              {" Page "}
              <strong>
                {pageIndex + 1 + " of " + pageOptions.length + " "}
              </strong>
            </span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
            >
              {[10, 25, 50].map((pageSize) => (
                <option className="option" key={pageSize} value={pageSize}>
                  Show {pageSize}
                </option>
              ))}
            </select>
            <button onClick={() => nextPage()} disabled={!canNextPage}>
              {">>"}
            </button>
          </span>
        </div>
      </div>
    </>
  );
}

function ForkTableWrapper() {
  const { forkTimeFrame, refreshTimer } = useForkBrowserContext();
  const { data } = useForksQuery(forkTimeFrame, refreshTimer);
  const tableData = data ?? [];

  return <ForkTable data={tableData} />;
}

function ForkBrowser() {
  return (
    <ForkBrowserProvider>
      <ToolBar />
      <ForkBlurbs />
      <ForkTableWrapper />
    </ForkBrowserProvider>
  );
}

export default ForkBrowser;
