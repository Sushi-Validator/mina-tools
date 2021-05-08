import React from 'react';
import './App.css';
import $ from 'jquery';


// Big ugly monster, clean this up later
// TODO: Cleanup, prettify output, add clickthrough per entry
function Update() {
  let last_week = Date.now() - 604800;
  let API = 'https://fork-checker-api-iyrf2hryca-uw.a.run.app/forks?';
  let DEFAULT_QUERY = 'updated_after=' + last_week + '&min_length=5'; // Get forks from within the past week that are length >= 5
  // jQuery AJAX - fetch might be a better fit (and is native), but AJAX is easy.
  $.ajax({
    url: API + DEFAULT_QUERY,
    async: true,
    dataType: 'json',
    success: function(data) {
      // Build a table containing our forks
      $(function() {
        // For each entry, add an entry showing the creator, timestamp, fork length, and lost rewards
        // Clickthrough should yield more complex information, this is just a brief overview and should be compact
        // HTML tables are ugly by default so I'm using a div, but this can be re-organized easily if this is a stupid idea
        let forktable = document.createElement("div");
        forktable.id = "Fork-Table";
        // Add each entry to its own div which will be contained within Fork-Table
        $.each(data, function(i, forks) {
          // Div
          let forkwrapper = document.createElement("div");
          forkwrapper.className = "Fork-Wrapper";
          let forkentry = document.createElement("div");
          forkentry.className = "Fork-Entry";
          forkentry.id = forks.id;
          let forkdetails = document.createElement("div");
          forkdetails.className = "Fork-Details";
          forkdetails.id = forks.id;
          // Data
          let timestamp = new Date(forks.last_updated)
          let localtimestamp = timestamp.toLocaleDateString('us-EN') + " at " + timestamp.toLocaleTimeString('us-EN');
          forkentry.innerText = forks.latest + ", created on: " + localtimestamp;
          forkwrapper.appendChild(forkentry);
          // Details
          forkdetails.innerText = "Created by: " + forks.creators[forks.creators.length - 1] + ", fork length: " + forks.length;
          forkwrapper.appendChild(forkdetails);
          // Integration
          forktable.appendChild(forkwrapper);
        });
        // Replace loading text with content
        $("#Fork-Table").replaceWith(forktable);
      });
    }
  });

  // Display a loading message while we wait for the API call
  return (
    <>
      <div id="Fork-Header">Latest Forks:</div>
      <div id="Fork-Table">Loading...</div>
    </>
  );
}

// Fetch URL queries and their value by key
function GetParameter(parameter: any) {
  let url = window.location.search.substring(1);
  let urlVars = url.split('?');
  var i;
  for (i = 0; i < urlVars.length; i++) {
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
// // TODO: API lookup using ID for detailed for information, add redirect if no fork query
function Details(parameter: any) {
  if (!parameter) {
    // Redirect should happen here if there is no fork at all
  }
  return "Under Construction";
}

// Main page
// TODO: Implement react-router properly for this page
const Index = () => (
  <div className="App">
    <header className="App-header">
      {Update()}
    </header>
  </div>
);

// Fork page
const Fork = () => {
  var forkID = GetParameter('fork');
  return (
    <div className="App">
      <header className="App-header">
        {Details(forkID)}
      </header>
    </div>
  )
};

export default Index;
