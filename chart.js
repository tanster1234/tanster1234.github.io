function draw(){
    var margin = {top: 10, right: 100, bottom: 30, left: 30},
        width = 920 - margin.left - margin.right,
        height = 400 - margin.top - margin.bottom;
    d3.select("svg").remove();
    var svg = d3.select("#my_dataviz")
        .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
        .append("g")
            .attr("transform",
                "translate(" + margin.left + "," + margin.top + ")");
        
        //Read the data
        var sel = document.getElementById('selectButton1').value;
        //var fileName = sel
        d3.csv(sel, function(data) {
        
            // List of groups (here I have one group per column)
        
            return { Date : d3.timeParse("%d/%m/%Y")(data.Date),  co :data.co, pm10: data.pm10, pm25:data.pm25}
        },
    
        function(data)
        {
            // add the options to the button
            var allGroup = ["co", "pm10", "pm25"]
            var countries = ["london", "wuhan"]
            console.log(sel)
        // add the options to the button
        d3.select("#radio")
            .attr("value", function (d) { return d; }) // corresponding value returned by the button
            
            // A color scale: one color for each group
            var myColor = d3.scaleOrdinal()
            .domain(allGroup)
            .range(d3.schemeSet2);
        
            // Add X axis --> it is a date format
            var x = d3.scaleTime()
            .domain(d3.extent(data, function(d) { return d.Date; }))
            .range([ 0, width ]);
            svg.append("g")
            .attr("transform", "translate(0," + height + ")")
            .call(d3.axisBottom(x));
            var pollutant = document.getElementById('selectButton').value;
            var dataMax = d3.max(data, function(d) { 
                //console.log(pollutant)
                if (pollutant=='co'){  
                    d.co = Math.max(d.co)
                    return d.co;
                }
                if (pollutant == 'pm10'){
                    d.pm10 = Math.max(d.pm10)
                    return d.pm10;
                }
                if (pollutant == 'pm25'){
                    d.pm25 = Math.max(d.pm25)
                    return d.pm25;
                }
            })
            console.log(dataMax)
            // Add Y axis
            var y = d3.scaleLinear()
            //.domain( [0,75])
            .domain([0, dataMax])
            .range([ height, 0 ]);
            svg.append("g")
            .call(d3.axisLeft(y));
        
            // Initialize line with group a
            var line = svg
            .append('g')
            .append("path")
                .datum(data)
                .attr("d", d3.line()
                .x(function(d) { return x(+d.Date) })
                .y(function(d) { return y(+d.co) })
                )
                .attr("stroke", function(d){ return myColor("valueA") })
                .style("stroke-width", 4)
                .style("fill", "none")
        
            // A function that update the chart
            function update(selectedGroup) {
        
            // Create new data with the selection?
            var dataFilter = data.map(function(d){return {time: d.Date, value:d[selectedGroup]} })
        
            // Give these new data to update line
            line
                .datum(dataFilter)
                .transition()
                .duration(1000)
                .attr("d", d3.line()
                    .x(function(d) { return x(+d.time) })
                    .y(function(d) { return y(+d.value) })
                )
                .attr("stroke", function(d){ return myColor(selectedGroup) })
            }
        
            // When the button is changed, run the updateChart function
            d3.select("#selectButton").on("change", function(d) {
                // recover the option that has been chosen
                var selectedOption = d3.select(this).property("value")
                // run the updateChart function with this selected option
                update(selectedOption)
            })
        
        })
}