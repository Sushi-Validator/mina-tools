import React from 'react';
import './App.css';
import $ from 'jquery';
import { Redirect, Route, BrowserRouter as Router } from 'react-router-dom';

// Will contain all of our visual fork data as a collection of HTML elements once Update() runs
var forkTable = document.createElement("div");

// This function will grab our fork data, organize it into divs, and then store it to a global variable for us to work with
// TODO: Producer
function Update(max: number, timeframe: number) {
  let window = Date.now() - (timeframe * 1000);

  let API = 'https://fork-checker-api-iyrf2hryca-uw.a.run.app/forks?';
  let DEFAULT_QUERY = 'updated_after=' + window + '&min_length=5';
$.ajax({
    url: API + DEFAULT_QUERY,
    async: true,
    dataType: 'json',
    success: function(data) {
      $(function() {
        console.log(data);
        // Reset forkTable for new content
        forkTable = document.createElement("div");
        forkTable.id = "Fork-Table";
        // Add each entry to its own div which will be contained within Fork-Table
        for (var i = 0; i < data.length; i++) {
          // Wrapper
          /*-----------------------------------------------*\
          | [TIMESTAMP]                                     |
          |-------------------------------------------------|
          | [LATEST FORK], BY [LATEST PRODUCER]             |
          |-------------------------------------------------|
          | [LENGTH] BLOCKS LONG, WITH [REWARDS] MINA LOST  |
          \*-----------------------------------------------*/

          let forkWrapper = document.createElement("div");
          forkWrapper.className = "Fork-Wrapper";
          forkWrapper.id = data[i].last_updated;
          forkWrapper.classList.add("hidden");

          // Timestamp
          let forkTimestamp = document.createElement("div");
          forkTimestamp.className = "Fork-Timestamp";
          let timestamp = new Date(data[i].last_updated)
          let localTimestamp = timestamp.toLocaleDateString('us-EN') + " at " + timestamp.toLocaleTimeString('us-EN');
          forkTimestamp.innerText = localTimestamp;
          forkWrapper.appendChild(forkTimestamp);

          // Links
          let forkLinks = document.createElement("div");
          forkLinks.className = "Fork-Links";
          let forkLatestLink = document.createElement("a");
          let forkProducerLink = document.createElement("a");
          let interemNode = document.createTextNode(", by ");
          forkLatestLink.href = "/Fork?fork=" + data[i].id;
          forkLatestLink.innerText = data[i].latest;
          forkProducerLink.href = "/Producer?producer=WIP";
          forkProducerLink.innerText = "Placeholder Producer";
          forkLinks.appendChild(forkLatestLink);
          forkLinks.appendChild(interemNode);
          forkLinks.appendChild(forkProducerLink);
          forkWrapper.appendChild(forkLinks);

          // Details
          let forkDetails = document.createElement("div");
          forkDetails.className = "Fork-Details";
          forkDetails.innerText = data[i].length + " blocks long, with " + data[i].rewards + " MINA lost."
          forkWrapper.appendChild(forkDetails);

          // Integration
          forkTable.appendChild(forkWrapper);
        };

        // Update complete, now "refresh" our display
        Refresh(max);
      });
    }
  });
}

// Function to set as visible a limited number of our processed forks
function Refresh(max: number) {
  let forks = Array.from(forkTable.children);
  // We need to reset the hidden status on all elements for cases with decrementing visibility
  for (var i = 0; i < forks.length; i++) {
    let caveman = forks[i] as HTMLElement;
    caveman.classList.add("hidden");
  }
  // Now un-hide however many we need
  for (i = 0; i < max; i++) {
    let caveman = forks[i] as HTMLElement;
    caveman.classList.remove("hidden");
  }
  // Remove the old fork div
  if($("#Fork-Table")[0]) {
    $("#Fork-Table").remove();
  }
  // ..And add our new one
  $(forkTable).insertAfter($("#Fork-Header"))
}

// Update timeframe options for the API call. Forces a data refresh.
function selector() {
  let selection = $("#Fork-Timeframe").get(0) as HTMLSelectElement;
  let counter = ($('#Fork-Quantity') as any).get(0)
  let reloading = document.createElement("div");
  reloading.id = "Fork-Table";
  reloading.innerText = "Reloading..."
  $("#Fork-Table").replaceWith(reloading);
  Update(parseInt(counter.innerText), parseInt(selection.value));
}

// Timer, using the basic setInterval() function. Used for automated refresh of API data.
// Starts initialized by default, in part so we have a handle to stop/modify it easily
var refreshTimer = setInterval(selector, 300000);
function resetTimer() {
  let selection = $("#refreshTimer").get(0) as HTMLSelectElement;
  let interval = parseInt(selection.value);
  clearInterval(refreshTimer);
  refreshTimer = setInterval(selector, interval);
}

// Counter modifier - this exists solely so we can use pretty buttons rather than an ugly stock input interface
function counter(increment: Boolean = true) {
  let counter = ($('#Fork-Quantity') as any).get(0);
  let forks = Array.from(forkTable.children); // Used to set our upper display limit
  // Increase counter by default; cap is arbitrarily set to 25
  if (increment) {
    counter.innerText = (counter.innerText++ > forks.length - 1) ? forks.length : counter.innerText++;
    Refresh(counter.innerText);
  }
  // Decrement otherwise; don't allow counter to drop below 1
  else {
    counter.innerText = (counter.innerText-- < 2) ? 1 : counter.innerText--;
    Refresh(counter.innerText);
  }
}

// Fetch URL queries and their value by key
function GetParameter(parameter: String) {
  let url = window.location.search.substring(1);
  let urlVars = url.split('?');
  for (var i = 0; i < urlVars.length; i++) {
    // varName is an array, with index 0 being the key and 1 being the value
    let varName = urlVars[i].split('=');
    if (varName[0] === parameter) {
      // If the value of varName is undefined, return null, otherwise return the value
      return varName[1] === undefined ? null : decodeURIComponent(varName[1]);
    }
  }
  // Null if does not exist/match
  return null;
}

// Display fork details
// TODO: Refactor to match Update() workflow
function Details(parameter: any) {
  if (!parameter) {
    // Redirect should happen here if there is no fork at all
    return <Redirect to="/Index" />
  }
  // AJAX call to the API for a specific fork
  let API = 'https://fork-checker-api-iyrf2hryca-uw.a.run.app/fork/'
  $.ajax({
    url: API + parameter,
    async: true,
    dataType: 'json',
    success: function(data) {
      $(function() {
        console.log(data)
        if (data.length === 0 || data[0] === undefined) {
          // Malformed id will still successfully return an empty JSON, so redirect as though no parameter was given
          window.location.href = '/Index';
        }

        // Wrapper

        /*-----------\ /----------------\ /-------------\
        | Fork Name  | | Fork Producers | | Fork Losses |
        \------------/ \----------------/ \-------------/

        /-----------------------------------------------\
        |                  Block Hash           (V)     |
        |-----------------------------------------------|
        |                  Timestamp                    |
        |-----------------------------------------------|
        |    Creator (link to creator pages, StakeTab)  |
        |-----------------------------------------------|
        |             View on MinaExplorer              |
        \----------------------------------------------*/

        let forkWrapper = document.createElement("div");
        forkWrapper.className = "Fork-Wrapper";
        forkWrapper.id = data[0].id;
        let forkDetails = document.createElement("div");
        forkDetails.className = "Fork-Details";
        forkDetails.innerText = "Viewing Fork with latest block = " + data[0].latest + "\n Under Construction";
        forkWrapper.appendChild(forkDetails);
      });
      Refresh(data.length);
    }
  });
}


// Main page
const Index = () => (
  <div className="App">
    <Router>
      <Route path="/fork" component={ Fork } />
      <Route path="/producer" component={ Producer } />
    </Router>
    <header className="App-header">
      <div id="Fork-Header">
        <div id="Logo">
        <img src="https://lithi.io/file/RiJn.webp"> </img>
        SUSHI VALIDATOR
        </div>
        <div id="Toolbar-Wrapper">
          Displaying&nbsp;
          <span className="counterWrapper">
            <button onClick={() => counter(false)}>–</button>
            <span id="Fork-Quantity">5</span>
            <button onClick={() => counter()}>+</button>
          </span>
          &nbsp;most recent forks from within the past&nbsp;
          <select onChange={() => selector()} id="Fork-Timeframe" defaultValue="604800">
          <option className="option" value="604800">Week</option>
          <option className="option" value="2629743">Month</option>
          <option className="option" value="31556926">Year</option>
          </select>
          <span className="refreshWrapper">
            <button onClick={() => selector()} id="refreshButton"></button>
            <select onChange={() => resetTimer()}  id="refreshTimer" defaultValue="300000">
            <option className="option" value="60000">1m</option>
            <option className="option" value="300000">5m</option>
            <option className="option" value="600000">10m</option>
            <option className="option" value="1800000">30m</option>
            <option className="option" value="3600000">1h</option>
            </select>
          </span>
        </div>
      </div>
      <div id="Fork-Table">Loading...</div>
      {Update(5, 604800)} 
    </header>
  </div>
);

// Fork page
// TODO: Decide on display/organizational layout for page/data and implement
const Fork = () => {
  let forkID = GetParameter('fork');
  return (
    <div className="App">
      <Router>
        <Route path="/index" component={ Index } />
      </Router>
      <header className="App-header">
        <div id="Fork-Table">Loading...</div>
        {Details(forkID)}
      </header>
    </div>
  )
};

// Producer page
// Huge TODO
const Producer = () => {
  return (
    <div className="App">
      <header className="App-header">
      </header>
    </div>
  )
};

export default Index;
