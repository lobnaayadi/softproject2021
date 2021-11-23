
var svg = d3.select("svg"),
    width = +svg.attr("width"),
    height = +svg.attr("height");

// Call zoom for svg container.
svg.call(d3.zoom().on('zoom', zoomed));

var color = d3.scaleOrdinal(d3.schemeCategory20);

var simulation = d3.forceSimulation()
    .force("link", d3.forceLink())
    .force("charge", d3.forceManyBody().strength([-120]).distanceMax([500]))
    .force("center", d3.forceCenter(width / 2, height / 2));

var container = svg.append('g');

// Toggle for ego networks on click (below).
var toggle = 0;

var dataPath = "https://keithmcnulty.github.io/game-of-thrones-network/json/got_network.json"

d3.json(dataPath, function(error, graph) {
  if (error) throw error;

  // Make object of all neighboring nodes.
  var linkedByIndex = {};
  graph.links.forEach(function(d) {
	  linkedByIndex[d.source + ',' + d.target] = 1;
	  linkedByIndex[d.target + ',' + d.source] = 1;
  });

  // A function to test if two nodes are neighboring.
  function neighboring(a, b) {
	  return linkedByIndex[a.index + ',' + b.index];
  }

  // Linear scale for degree centrality.
  var degreeSize = d3.scaleLinear()
  	.domain([d3.min(graph.nodes, function(d) {return d.degree; }),d3.max(graph.nodes, function(d) {return d.degree; })])
  	.range([8,25]);

  // Collision detection based on degree centrality.
  simulation.force("collide", d3.forceCollide().radius( function (d) { return degreeSize(d.degree); }));

  var link = container.append("g")
      .attr("class", "links")
    .selectAll("line")
    .data(graph.links, function(d) { return d.source + ", " + d.target;})
    .enter().append("line")
      .attr('class', 'link')
      .style('stroke', d => color(d.group));

  var node = container.selectAll(".node")
    .data(graph.nodes)
    .enter()
    .append("g")
    .attr("class", "node");
   
  node.append("circle")
    // Calculate degree centrality within JavaScript.
    // .attr("r", function(d, i) { count = 0; graph.links.forEach(function(l) { if (l.source == i || l.target == i) { count += 1;}; }); return count;})
    // Use degree centrality from R igraph in json.
    .attr('r', function(d, i) { return degreeSize(d.degree); })
    .attr('cx', d => d.x)
    .attr('cy', d => d.y)
    // Color by group, a result of modularity calculation in R igraph.
      .attr("fill", function(d) { return color(d.group); })
      .attr('class', 'node')
      // On click, toggle ego networks for the selected node.
      .on('click', function(d, i) {
	      if (toggle == 0) {
		      // Ternary operator restyles links and nodes if they are adjacent.
		      d3.selectAll('.link').style('stroke-opacity', function (l) {
			      return l.target == d || l.source == d ? 1 : 0.1;
		      });
		      d3.selectAll('.node').style('opacity', function (n) {
			      return neighboring(d, n) ? 1 : 0.1;
		      });
		      d3.select(this).style('opacity', 1);
		      toggle = 1;
	      }
	      else {
		      // Restore nodes and links to normal opacity.
		      d3.selectAll('.link').style('stroke-opacity', '0.6');
		      d3.selectAll('.node').style('opacity', '1');
		      toggle = 0;
	      }
      })
      .call(d3.drag()
          .on("start", dragstarted)
          .on("drag", dragged)
          .on("end", dragended));

node.append("title")
    .text(d => d.name);

  simulation
      .nodes(graph.nodes)
      .on("tick", ticked);

  simulation.force("link")
      .links(graph.links);

  function ticked() {
    link
        .attr("x1", function(d) { return d.source.x; })
        .attr("y1", function(d) { return d.source.y; })
        .attr("x2", function(d) { return d.target.x; })
        .attr("y2", function(d) { return d.target.y; });

        node.attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; });
    node
        .attr("transform", d => "translate(" + d.x + "," + d.y + ")");

  }


  	// A slider that removes nodes below the input threshold.
	var slider = d3.select('body').append('p').append('center').text('zoom in and zoom out').style('font-size', '60%');

	slider.append('label')
		.attr('for', 'threshold')
        .text('1').style('font-weight', 'bold')
        .style('font-size', '120%')
        .style('')
	slider.append('input')
		.attr('type', 'range')
		.attr('min', 1)
		.attr('max', d3.max(graph.links, function(d) {return d.weight; }) / 2)
		.attr('value', 1)
		.attr('id', 'threshold')
		.style('width', '50%')
		.style('display', 'block')
		.on('input', function () { 
			var threshold = this.value;

			d3.select('label').text(threshold);

			// Find the links that are at or above the threshold.
			var newData = [];
			graph.links.forEach( function (d) {
				if (d.weight >= threshold) {newData.push(d); };
			});

			// Data join with only those new links.
			link = link.data(newData, function(d) {return d.source + ', ' + d.target;});
			link.exit().remove();
			var linkEnter = link.enter().append('line').attr('class', 'link')
      .style('stroke', d => color(d.group));
			link = linkEnter.merge(link);

			node = node.data(graph.nodes);

			// Restart simulation with new link data.
			simulation
				.nodes(graph.nodes).on('tick', ticked)
				.force("link").links(newData);

			simulation.alphaTarget(0.1).restart();

		});

    // add a legend
    var legend = d3.select("#legend")
        .append("svg")
        .attr("class", "legend")
        .attr("width", 180)
        .attr("height", 200)
        .selectAll("g")
        .data(color.domain())
        .enter()
        .append("g")
        .attr("transform", function(d, i) {
        return "translate(0," + i * 20 + ")";
        });
    
    legend.append("rect")
        .attr("width", 18)
        .attr("height", 18)
        .style("fill", color);
    
    // load legend names from data_label column
    var legendNames = [];
    var map = new Map();
    for (var item of graph.nodes) {
        if(!map.has(item.group)){
            map.set(item.group, true);    // set any value to Map
            legendNames.push({
                id: item.group,
                groupName: item.data_label
            });
        }
    }
 
    });

function dragstarted(d) {
  if (!d3.event.active) simulation.alphaTarget(0.3).restart();
  d.fx = d.x;
  d.fy = d.y;
}

function dragged(d) {
  d.fx = d3.event.x;
  
  d.fy = d3.event.y;
}

function dragended(d) {
  if (!d3.event.active) simulation.alphaTarget(0);
  d.fx = null;
  d.fy = null;
}

// Zooming function translates the size of the svg container.
function zoomed() {
	  container.attr("transform", "translate(" + d3.event.transform.x + ", " + d3.event.transform.y + ") scale(" + d3.event.transform.k + ")");
}
var zoom = d3.behavior.zoom().scaleExtent([0.1,5]).on("zoom", redraw);
var svg = d3.select("body")
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .call(zoom).on("dblclick.zoom", null)
    .append('g');

// The magic function.
function getScreenCoords(x, y, ctm) {
  var xn = ctm.e + x*ctm.a + y*ctm.c;
  var yn = ctm.f + x*ctm.b + y*ctm.d;
  return { x: xn, y: yn };
}

var circle = document.getElementById('svgCircle'),
cx = +circle.getAttribute('cx'),
cy = +circle.getAttribute('cy'),
ctm = circle.getCTM(),
coords = getScreenCoords(cx, cy, ctm);
console.log(coords.x, coords.y); // shows coords relative to my svg container
// get position

































// //  function getPosition to get the position of element.
// function getPosition(event, d) {
//   const element = d3.select(this);
//   const val = element.attr('transform').split(/[s,()]+/);
//   const x = parseFloat(val[1]);
//   const y = parseFloat(val[2]);
//   console.log(x, y)
// }
// //  check the element is visible or not .

// function isInViewport(el) {
//   const rect = el.getBoundingClientRect();
//   return (
//       rect.top >= 0 &&
//       rect.left >= 0 &&
//       rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
//       rect.right <= (window.innerWidth || document.documentElement.clientWidth)

//   );
// }
// const element = document.querySelector('.element');
// const message = document.querySelector('#message');

// document.addEventListener('zoomed', function () {
//   const messageText = isInViewport(element) ?
//       'This element  is visible in the viewport' :
//       'The element  is not visible in the viewport';

//   message.textContent = messageText;

// }, {
//   passive: true
// });

// // // Draw an arrowhead  connected to a line 
// // svg
// //     .append('defs')
// //     .append('marker')
// //     .attr('id', 'arrow')
// //     .attr('viewBox', [0, 0, markerBoxWidth, markerBoxHeight])
// //     .attr('refX', refX)
// //     .attr('refY', refY)
// //     .attr('markerWidth', markerBoxWidth)
// //     .attr('markerHeight', markerBoxHeight)
// //     .attr('orient', 'auto-start-reverse')
// //     .append('path')
// //     .attr('d', d3.line()(arrowPoints))
// //     .attr('stroke', 'black');

// //   svg
// //     .append('path')
// //     .attr('d', d3.line()([[100, 60], [40, 90], [200, 80], [300, 150]]))
// //     .attr('stroke', 'black')
// //     .attr('marker-end', 'url(#arrow)')
// //     .attr('fill', 'none');

// //   return svg.node();
// //retur if the element is in viewport or not .
// function isElementVisible(el) {
//   var node     = el.getBoundingClientRect(),
//       vWidth   = window.innerWidth || document.documentElement.clientWidth,
//       vHeight  = window.innerHeight || document.documentElement.clientHeight,
//       efp      = function (x, y) { return document.elementFromPoint(x, y) };     

//   // Return false if it's not in the viewport
//   if (graph.node.right < 0 || graph.node.bottom < 0 
//           || graph.node.left > vWidth || graph.node.top > vHeight)
//       return false;

//   // Return true if any of its four corners are visible
//   return (
//         el.contains(efp(graph.node.left,  graph.node.top))
//     ||  el.contains(efp(graph.node.right, graph.nodenode.top))
//     ||  el.contains(efp(graph.node.right, graph.node.bottom))
//     ||  el.contains(efp(grap.node.left,  graph.node.bottom))
//   );
// }








