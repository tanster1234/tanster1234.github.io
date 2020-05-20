function chloropleth(){
    // The svg
    console.log("hello")
    var svg = d3.select("svg"),
    width = +svg.attr("width"),
    height = +svg.attr("height");
  
  // Map and projection
  var path = d3.geoPath();
  var projection = d3.geoMercator()
    .scale(70)
    .center([0,20])
    .translate([width / 2, height / 2]);
  
  // Data and color scale
  var data = d3.map();
  var colorScale = d3.scaleThreshold()
    .domain([15, 30, 45, 60, 75,90,105])
    .range(d3.schemeReds[7]);
  
  // Load external data and boot
  d3.queue()
    .defer(d3.json, "https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson")
    .defer(d3.csv, "/Data/chloroplethworld.csv", function(d) { data.set(d.code, +d.pop); })
    .await(ready);
  
  function ready(error, topo) {
  
    // Draw the map
    svg.append("g")
      .selectAll("path")
      .data(topo.features)
      .enter()
      .append("path")
        // draw each country
        .attr("d", d3.geoPath()
          .projection(projection)
        )
        // set the color of each country
        .attr("fill", function (d) {
          d.total = data.get(d.id) || 0;
          return colorScale(d.total);
        });
      }
}