var fieldSeparator = ',', rowSeparator = ' ';
var latencyGraphData = [], latencySelectData = []; // latencyGraphData[idx] = [device name, [[region size, result], ...], selected = true/false]
var graphArray;
var stackedChartCount = 0;
var chartOptions = {
    'title': 'Cache and Memory Bandwidth',
    width: "90%",
    chartArea: {width: "70%", height: "80%"},
    'legend': {position: "right", alignment: "start", textStyle: {fontSize: 12}},
    'hAxis': {'title': 'Region Size (KB)', textStyle: {fontSize: 10}, scaleType: 'log', ticks: [0, 4, 16, 64, 256, 1024, 4096, 16384, 65536, 262144, 1048576, 2097152, 3145728]},
    'vAxis': {'title': 'Bandwidth (GB/s)', scaleType: 'linear' }
};
google.charts.load('current', {'packages': ['corechart']});

fetch("data/bandwidth.json")
    .then(response => response.json())
    .then(json => init(json))

function init(latencyJson) {
    for (var i = 0; i < latencyJson.length; i++) {
        var dataPoint = latencyJson[i]
        var resultName = dataPoint.name;
        var resultType = dataPoint.type;
        var resultDataArr = dataPoint.data.split(rowSeparator);
        var resultComment = dataPoint.comment;
        var resultLatencyData = [];
        for (var j = 0; j < resultDataArr.length; j++) {
            var resultLineArrRaw = resultDataArr[j].split(fieldSeparator);

            // excel paste gives consecutive spaces, so make empty strings (= false) go away
            var resultLineArr = resultLineArrRaw.filter(e => e);
            if (resultLineArr.length < 2) continue;
            resultLineArr[0] = parseFloat(resultLineArr[0]);
            resultLineArr[1] = parseFloat(resultLineArr[1]);
            resultLineArr[2] = false;
            resultLatencyData.push(resultLineArr);
        }
        latencySelectData.push([resultName, resultType, resultComment]);
        latencyGraphData.push([resultName, resultLatencyData]);
    }

    var collator = new Intl.Collator([], {numeric: true});
    latencySelectData.sort((a, b) => collator.compare(a[0], b[0]));
    latencyGraphData.sort((a, b) => collator.compare(a[0], b[0]));
    //latencyGraphData = latencyGraphData.sort((a,b) => b[1].length - a[1].length != 0 ? b[1].length - a[1].length : a[0].localeCompare(b[0], 'en', { ignorePunctuation: true }));

    var cpuStDataContainer = document.getElementById('cpuStDataContainer');
    var cpuInstrFetchContainer = document.getElementById('cpuInstrFetchContainer');
    var cpuSharedDataContainer = document.getElementById('cpuSharedDataContainer');
    var cpuPrivateDataContainer = document.getElementById('cpuPrivateDataContainer');
    var cpuWritePrivateDataContainer = document.getElementById('cpuWritePrivateDataContainer');
    var cpuWriteStDataContainer = document.getElementById('cpuWriteStDataContainer');
    var openclDataContainer = document.getElementById('openclDataContainer');
    var vulkanDataContainer = document.getElementById('vulkanDataContainer');
    var testDataContainer = document.getElementById('testDataContainer');

    for (var i = 0; i < latencyGraphData.length; i++) {
        let name = latencySelectData[i][0]
        let type = latencySelectData[i][1]

        let container;
        if (type === "cpu-st") container = cpuStDataContainer
        else if (type === "cpu-instr") container = cpuInstrFetchContainer
        else if (type === "cpu-shared") container = cpuSharedDataContainer
        else if (type === "cpu-private") container = cpuPrivateDataContainer
        else if (type === "cpu-private-write") container = cpuWritePrivateDataContainer
        else if (type === "cpu-st-write") container = cpuWriteStDataContainer
        else if (type === "opencl") container = openclDataContainer
        else if (type === "vulkan") container = vulkanDataContainer
        else if (type === "test") container = testDataContainer
        else container = otherDataContainer

        container.innerHTML += "<div class='selectData' onclick='toggleSelectedData(" + i + ");' id='selectData" + i + "'>" + name + "</div>";
    }
}

function toggleSelectedData(idx) {
    if (idx >= latencyGraphData.length) return;
    latencyGraphData[idx][2] = !latencyGraphData[idx][2];
    updateSelections();
    graphSelectedData();
    updateComments()
}

function redraw() {
    updateSelections();
    graphSelectedData();
    updateComments() 
}

// show what data is selected
function updateSelections() {
    for (var i = 0; i < latencyGraphData.length; i++) {
        if (latencyGraphData[i][2]) {
            document.getElementById("selectData" + i).className = "selectData selectedData";
        } else {
            document.getElementById("selectData" + i).className = "selectData";
        }
    }
}

function updateComments() {
    var dataComment = "";
    for (var i = 0; i < latencyGraphData.length; i++) {
        if (latencyGraphData[i][2] && latencySelectData[i][2] !== undefined) { // selected, and has comment
            // Comment/Name are set in init, from datPoint.name and dataPoint.comment
            var selectionName = latencySelectData[i][0];
            var selectionComment = latencySelectData[i][2];
            dataComment += "<p>" + selectionName + ": " + selectionComment;
            dataComment += " <input type='button' value='export' onclick=\"exportData(" + i + ")\" />"
            dataComment += "</p>"; 
        }
    }

    document.getElementById('resultComment').innerHTML = dataComment;
}

// attempt to graph data with non-matching x series on the same graph, with one google chart draw
function graphSelectedData() {
    graphArray = [['Region Size (KB)']];
    var chartDiv = document.getElementById("chart");
    chartDiv.innerHTML = "";
    var lineIdx = 0;
    var rowIdx = 0;
    for (var i = 0; i < latencyGraphData.length; i++) {
        if (latencyGraphData[i][2]) {
            // set name, with type suffix
            var type = latencySelectData[i][1];
            var typeLabel = "";
            if (type === "cpu-st") typeLabel = "ST";
            else if (type == "cpu-shared") typeLabel = "Shared Read";
            else if (type == "cpu-private") typeLabel = "Private Read";
            else if (type == "cpu-private") typeLabel = "Private Read";
            else if (type == "cpu-private-write") typeLabel = "Private Write";
            else if (type == "cpu-instr") typeLabel = "Code Fetch";
            graphArray[0][lineIdx + 1] = latencyGraphData[i][0] + " " + typeLabel;

            for (rowIdx = 0; rowIdx < latencyGraphData[i][1].length; rowIdx++) {
                // find a matching row
                var matchFound = false;
                for (var findRowIdx = 0; findRowIdx < graphArray.length; findRowIdx++) {
                    if (graphArray[findRowIdx][0] === latencyGraphData[i][1][rowIdx][0]) {
                        graphArray[findRowIdx][lineIdx + 1] = latencyGraphData[i][1][rowIdx][1];
                        matchFound = true;
                        break;
                    }
                }

                if (!matchFound) {
                    var newRow = [];
                    newRow[0] = latencyGraphData[i][1][rowIdx][0];
                    for (var newRowBackfillIdx = 1; newRowBackfillIdx < lineIdx + 1; newRowBackfillIdx++) {
                        newRow[newRowBackfillIdx] = undefined;
                    }

                    newRow[lineIdx + 1] = latencyGraphData[i][1][rowIdx][1];
                    graphArray.push(newRow);
                }
            } // end loop through rows in result

            lineIdx++;
        }
    }

    // another backfill pass
    var maxRowElements = 0;
    for (rowIdx = 0; rowIdx < graphArray.length; rowIdx++)
        if (graphArray[rowIdx].length > maxRowElements) maxRowElements = graphArray[rowIdx].length;
    for (rowIdx = 0; rowIdx < graphArray.length; rowIdx++) {
        if (graphArray[rowIdx].length < maxRowElements) {
            for (var backfillIdx = graphArray[rowIdx].length; backfillIdx < maxRowElements; backfillIdx++) {
                graphArray[rowIdx][backfillIdx] = undefined;
            }
        }
    }

    graphArray = graphArray.sort((a, b) => (typeof a[0] === 'string') ? -1 : (typeof b[0] === 'string') ? 1 : a[0] - b[0]);

    // make google charts use continuous lines (why is this so annoying)
    for (rowIdx = 0; rowIdx < graphArray.length; rowIdx++) {
        for (var colIdx = 0; colIdx < graphArray[rowIdx].length; colIdx++) {
            if (graphArray[rowIdx][colIdx] === undefined) {
                var prevValue = 0, nextValue = 0;
                var prevValueFound = false, nextValueFound = false;
                // find previous value. but don't go to row 0 because it's column headers
                for (var prevRowIdx = rowIdx; prevRowIdx > 0; prevRowIdx--) {
                    if (graphArray[prevRowIdx][colIdx] !== undefined) {
                        prevValueFound = true;
                        prevValue = graphArray[prevRowIdx][colIdx];
                        break;
                    }
                }

                for (var nextRowIdx = rowIdx; nextRowIdx < graphArray.length; nextRowIdx++) {
                    if (graphArray[nextRowIdx][colIdx] !== undefined) {
                        nextValueFound = true;
                        nextValue = graphArray[nextRowIdx][colIdx];
                        break;
                    }
                }

                if (prevValueFound === true && nextValueFound === true) {
                    graphArray[rowIdx][colIdx] = (prevValue + nextValue) / 2;
                } else if (nextValueFound) {
                    graphArray[rowIdx][colIdx] = nextValue;
                }
                // don't attempt to interpolate if we're at the high end (only previous value found)
            } // end undefined / need interpolation case
        }
    }

    var chartData = google.visualization.arrayToDataTable(graphArray);

    // in case window got resized, calculate width/height here
    if (window.innerWidth > 840) {
        chartOptions['height'] = 500;
        chartOptions['legend'] = {alignment: "start", position: "right", textStyle: {fontSize: 10}};
    } else {
        chartOptions['height'] = 400;
        chartOptions['legend'] = {alignment: "start", position: "in", textStyle: {fontSize: 10}}
    }

    if (document.getElementById('logCheckbox').checked) chartOptions['vAxis']['scaleType'] = 'log';
    else chartOptions['vAxis']['scaleType'] = 'linear';

    chart = new google.visualization.LineChart(chartDiv);
    chart.draw(chartData, chartOptions);
}

window.addEventListener('resize', () => graphSelectedData());

// fucking stack the charts on top of each other with opacity = 0.5?
function graphSelectedDataMultipleChart() {
    // delete all stacked charts
    for (var stackedChartIdx = 0; stackedChartIdx < stackedChartCount; stackedChartIdx++) {
        var stackedChart = document.getElementById("chart" + stackedChartIdx);
        if (stackedChart) document.body.removeChild(stackedChart);
    }

    // determine min/max values by going through all selected data
    // but keep ymin at 0
    var xmin = 16, xmax = 0, ymin = 0, ymax = 0;
    for (var i = 0; i < latencyGraphData.length; i++) {
        for (rowIdx = 0; rowIdx < latencyGraphData[i][1].length; rowIdx++) {
            var regionSize = latencyGraphData[i][1][rowIdx][0];
            var resultValue = latencyGraphData[i][1][rowIdx][1];
            if (regionSize < xmin) xmin = regionSize;
            if (regionSize > xmax) xmax = regionSize;
            if (resultValue > ymax) ymax = resultValue; // have y start at 0, don't set ymin
        }
    }

    var chartIdx = 0;
    for (var i = 0; i < latencyGraphData.length; i++) {
        if (latencyGraphData[i][2]) {
            chartOptions['width'] = Math.floor(window.innerWidth - 350);
            chartOptions['height'] = Math.floor(window.innerHeight * 0.7);
            chartOptions['vAxis']['viewWindow'] = {"min": ymin, "max": ymax};
            chartOptions['hAxis']['viewWindow'] = {"min": xmin, "max": xmax};
            graphDataSeries(i, chartIdx);
            chartIdx++;
        }
    }

    stackedChartCount = chartIdx + 1;
}

// draw a chart with one data series
function graphDataSeries(idx, chartIdx) {
    var graphArray = [['Region Size (KB)']];

    // set name. graph line idx = 1 bc only one line drawn per graph draw
    graphArray[0][1] = latencyGraphData[idx][0];

    var selectedGraphData = latencyGraphData[idx][1];
    for (var rowIdx = 0; rowIdx < selectedGraphData.length; rowIdx++) {
        if (graphArray[rowIdx + 1] == undefined) {
            graphArray[rowIdx + 1] = [];
            graphArray[rowIdx + 1][0] = selectedGraphData[rowIdx][0];
            graphArray[rowIdx + 1][1] = selectedGraphData[rowIdx][1];
        }
    }

    var chartDiv = document.createElement("div");
    chartDiv.className = "fixedchart";
    chartDiv.id = "chart" + chartIdx;
    document.body.appendChild(chartDiv);
    var chartData = google.visualization.arrayToDataTable(graphArray);
    chart = new google.visualization.LineChart(chartDiv);
    chart.draw(chartData, chartOptions);
} 

function exportData(idx) {
    var exportDiv = document.getElementById("exportContainer");
    var dataArr = latencySelectData[idx];
    var exportStr = latencySelectData[idx][0] + "<br />Test Size, Bandwidth (GB/s)<br />";
    for (var rowIdx = 0; rowIdx < latencyGraphData[idx][1].length; rowIdx++) {
        exportStr += latencyGraphData[idx][1][rowIdx][0] + "," + latencyGraphData[idx][1][rowIdx][1] + "<br />";
    }
    
    var closeButtonHtml = "<input type='button' value='close' onclick='document.getElementById(\"exportContainer\").style.display = \"none\"' /><br />";
    exportContainer.innerHTML = closeButtonHtml + exportStr;
    exportContainer.style.display = "block";
}

function updateFilter() {
    var filterText = document.getElementById('filtertext').value;
    if (filterText === "") {
        // set everything to display: inline
        for (var i = 0; i < latencyGraphData.length; i++) {
            document.getElementById("selectData" + i).style.display = "block";
        }

        return;
    }

    filterText = filterText.toLowerCase();
    for (var i = 0; i < latencyGraphData.length; i++) {
        var matchesFilter = false;
        if (latencySelectData[i][0].toLowerCase().includes(filterText)) matchesFilter = true;
        if (latencySelectData[i][2] !== undefined) {
            if (latencySelectData[i][2].toLowerCase().includes(filterText)) matchesFilter = true;
        }

        if (matchesFilter) document.getElementById("selectData" + i).style.display = "block";
        else document.getElementById("selectData" + i).style.display = "none";
    }
}
