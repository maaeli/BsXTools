import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import {Button} from 'react-bootstrap';
import { Stage, Layer, Rect, Line, Group, Circle, Context} from 'react-konva';
import { Image as Kimage } from 'react-konva';
import {RangeSlider} from 'reactrangeslider';

import './App.css';

import io from 'socket.io-client';
const socket = io.connect("http://0.0.0.0:8081");



/*This section is to be extended to allow a section of colormaps
Also, negative values need to be handled depending on the chosen map*/
var colormap = require('colormap')
const colormapoptions = {
       colormap: "jet",   // pick a builtin colormap or add your own
       nshades: 255 ,      // how many divisions
       format: "rgb",     // "hex" or "rgb" or "rgbaString"
       alpha: 1  ,        // set an alpha value or a linear alpha mapping [start, end]
}
const cg = colormap(colormapoptions);
const color = (bw,cg) => (bw < 0)
    ? [0,0,0]
    : cg[Math.floor((colormapoptions.nshades-1)*bw/255)]


const padding = 0;
const scrollBarWidth = 10;
const canvasHeight = 330;
const canvasWidth = 560;
const minCounts = -2;
const maxCounts = 2000;


class App extends Component {

  constructor(props){
     super(props)
     this.mainLayer = React.createRef();
     this.kImage = React.createRef();
     this.state = {imageScaleX: 1,
                   imageScaleY: 1,
                   imageOffsetX: 0,
                   imageOffsetY: 0,
                   drawing: "None",
                   objectUnderCreation: [],
                   MaskObjects: [],
                   zoom: 100,
                   //limits for intensity display

                   logInt: false,
                   rawData: {},
                   posX: 0,
                   posY: 0,
                   intensity: 0,
                   image: null,
                   scrollX: 0,
                   scrollY: 0,
                   y: 0,
                   x: 0,
                   scrollBarLength: canvasHeight,
                   scrollBarWidth: canvasWidth,
                   imageWidth:  canvasWidth,
                   imageHeight:  canvasHeight,
                   lastClick: null,
                   maxInt: 1000,
                   minInt: 0,
                  };

     this.createImg = this.createImg.bind(this);
     this.updateImg = this.updateImg.bind(this);
     this.transformData = this.transformData.bind(this);

     this.zoomSelect = this.zoomSelect.bind(this);
     this.addPolygonStart = this.addPolygonStart.bind(this);
     this.canvasMouseMove = this.canvasMouseMove.bind(this);
     this.canvasClick = this.canvasClick.bind(this);
     this.canvasDblClick = this.canvasDblClick.bind(this);
     this.requestData = this.requestData.bind(this);
     this.editPolygon = this.editPolygon.bind(this);
     this.moveImage = this.moveImage.bind(this);
     this.imageDragBox = this.imageDragBox.bind(this);
     this.verticalScroll = this.verticalScroll.bind(this);
     this.horizontalScroll = this.horizontalScroll.bind(this);
     this.minIntChanged = this.minIntChanged.bind(this);
     this.maxIntChanged = this.maxIntChanged.bind(this);
  }

 minIntChanged(event) {
   const newMin = Math.min(event.target.value, this.state.maxInt-1);
   this.setState(prevState => ({minInt: newMin}));
   if (this.state.rawData && this.state.rawData.data) {
   const newImg = this.transformData(this.state.rawData.data,this.state.rawData.width, this.state.rawData.height);
  // this.updateImg(newImg);
  }
 }

 maxIntChanged(event) {
   const newMax = Math.max(event.target.value, this.state.minInt+1);
   this.setState(prevState => ({maxInt: newMax}));
   if (this.state.rawData && this.state.rawData.data) {
     const time = event.timeStamp;
     if (this.state.lastImageUpdate) {
       if (time - this.state.lastImage < 10000 ){
             //We just updated, let's wait
             return;
           }
     }
     this.setState(prevState => ({lastImageUpdate: time}));
     var newImg = this.transformData(this.state.rawData.data,this.state.rawData.width, this.state.rawData.height);
    // this.updateImg(newImg);
   }
 }

  //Data relatefunctions
  requestData() {
    console.log("request data")
    socket.on('data2d', (data2d) => {

      this.setState(prevState => ({
         rawData: {data: data2d.data, width: data2d.width, height: data2d.height},
         imageWidth: data2d.width,
         imageHeight: data2d.height,
       }));
      //var newImg = this.transformData(data2d.data, data2d.width, data2d.height);

      //Image.src =
      //console.log(data2d.data)
      //this.createImg(newImg);

    });
    socket.emit('data2d');
    var newImg = new Image;

    //var blob = '';
    fetch("http://0.0.0.0:8081/imagergb", { method: "GET", // *GET, POST, PUT, DELETE, etc.
        mode: "cors", // no-cors, cors, *same-origin
        dataType: 'blob'
      }).then(response => {
        console.log(response)
        return response.blob();
    }).then(myBlob => {
      console.log(myBlob)
      var objectURL = URL.createObjectURL(myBlob);
      newImg.src = objectURL;
      //this.createImg(newImg)
      console.log(newImg)
    }).catch(function(error) {
      console.log('There has been a problem with your fetch operation: ', error.message);
    });

      this.setState(prevState => ({image:newImg,}));
      console.log(newImg)
     //}
    //newImg.src = "http://0.0.0.0:8081/imagergb/0/0.png";
  }






  transformData(bwdata, width, height){
    console.log("transform")
    var canvasin=this.refs.inputcanvas;
    canvasin.width = width;
    canvasin.height = height;
    var ctx = canvasin.getContext("2d");

    const nativeCtx = this.mainLayer.current.getContext()._context;
    //const ctx = canvasin.getContext("2d");
    var data = new Uint8ClampedArray(bwdata.length*4);

    for (let i = 0; i < bwdata.length; i += 1) {
      let intensity = bwdata[i];
      intensity = (0 <= intensity && intensity <= this.state.minInt) ? this.state.minInt : intensity
      //intensity = (0 <= intensity && intensity <= ) ? 0 : intensity
      intensity = (intensity >= this.state.maxInt) ? this.state.maxInt : intensity
      intensity = (255*(intensity - this.state.minInt)/(this.state.maxInt - this.state.minInt))
      let rgb = color(intensity,cg);
      data[4*i] = rgb[0];
      data[4*i + 1] = rgb[1];
      data[4*i + 2] = rgb[2];
      data[4*i + 3] = 254;
    }
    var idata = ctx.createImageData(width, height);
    var idata2 = nativeCtx.createImageData(width, height);
    idata.data.set(data);
    idata2.data.set(data);
    //console.log(idata);
    ctx.putImageData(idata, 0,0);
    nativeCtx.putImageData(idata2, 0,0);
    var image=new Image();

    image.src=canvasin.toDataURL();
    console.log(image.height)
    //this.createImg(image)

    return image;

  }

  createImg(img)  {
  console.log(img.height)

   const scalingFactorW = (canvasWidth-scrollBarWidth)/img.width
   const scalingFactorH = (canvasHeight-scrollBarWidth)/img.height
   const scalingFactor = Math.min(scalingFactorW,scalingFactorH)
   const offsetX = Math.floor(canvasWidth - img.width*scalingFactor)/2 - scrollBarWidth;
   const offsetY = Math.max(0,((canvasHeight - img.height*scalingFactor)/2 - scrollBarWidth));
   img.width = img.width*scalingFactor;
   img.height = img.height*scalingFactor;

    this.setState(prevState => ({
      image: img,
      imageScaleX: img.width/this.state.rawData.width, //img.width is always int!
      imageScaleY: img.height/this.state.rawData.height, //img.width is always int!
      imageOffsetX: offsetX,
      imageOffsetY: offsetY,
     }));

  }

  updateImg(img)  {
    if (this.state.img) {
     return;
   }
  console.log(img.width);
   const scalingFactorW = (canvasWidth-scrollBarWidth)/img.width
   const scalingFactorH = (canvasHeight-scrollBarWidth)/img.height
   const scalingFactor = Math.min(scalingFactorW,scalingFactorH)
   const offsetX = Math.floor(canvasWidth - img.width*scalingFactor)/2 - scrollBarWidth;
   const offsetY = Math.max(0,((canvasHeight - img.height*scalingFactor)/2 - scrollBarWidth));
   img.width = img.width*scalingFactor;
   img.height = img.height*scalingFactor;
   console.log(scalingFactor)

    this.setState(prevState => ({
      image: img,
      imageScaleX: img.width/this.state.rawData.width, //img.width is always int!
      imageScaleY: img.height/this.state.rawData.height, //img.width is always int!
      //imageOffsetX: offsetX,
      //imageOffsetY: offsetY,
     }));

  }

  //Canvas actions

  verticalScroll(delta) {
      //currenlty naively assumes image exists!
      const y = -delta * (this.state.image.height*this.state.zoom/100 - canvasHeight)- this.state.imageOffsetY*this.state.zoom/100;
      this.setState(prevState => ({scrollY: delta, y: y}))

  }

  horizontalScroll(delta) {
      const x =  - delta * (this.state.image.width*this.state.zoom/100-canvasWidth) - this.state.imageOffsetX*this.state.zoom/100;
      this.setState(prevState => ({scrollX: delta, x: x}))
  }


  canvasMouseMove(event) {

      const posX = event.evt.layerX;
      const posY = event.evt.layerY;

      //starting at 1,1!
      const realX = (100*(posX-this.state.x)/this.state.zoom - this.state.imageOffsetX)/this.state.imageScaleX + 1;
      const realY = (100*(posY-this.state.y)/this.state.zoom - this.state.imageOffsetY)/this.state.imageScaleY + 1;
      var int1D = 0;

      try {
        //1,1 -> 0!
       int1D = this.state.rawData.data[Math.floor(realY-1)*this.state.rawData.width+ Math.floor(realX-1)];
      }
      catch (err) {
        console.log(err);

       }
      this.setState(prevState => ({posX: realX, posY: realY, intensity:int1D}));
  }

  canvasClick(options) {
    const posX = options.evt.layerX;
    const posY = options.evt.layerY;
    const time = options.evt.timeStamp;
    if (this.state.lastClick) {
      if (Math.abs(this.state.lastClick[0] - posX) < 2 &&
          Math.abs(this.state.lastClick[1] - posY) < 2 && //DoubleClick!
          (time - this.state.lastClick[2]) < 250 ){
            this.canvasDblClick(options);
            return;
          }
    }
    this.setState(prevState => ({
       lastClick: [posX,posY, time]
     }));
    switch(this.state.drawing) {
       case "polygon":
         const newPoint = {x: (posX-  this.state.x)/this.state.zoom*100,
                           y: (posY-  this.state.y)/this.state.zoom*100};

         this.setState(prevState => ({
            objectUnderCreation: [...prevState.objectUnderCreation, newPoint]
          }));
          //console.log(this.state.objectUnderCreation);

         break;
       default:
         break;
     }
  }

  canvasDblClick(options) {
    switch(this.state.drawing) {
       case "polygon":
         const newObject = this.state.objectUnderCreation;
         if (newObject.length > 3) {
           //the last point actually comes from this double-click,
           // we might consider removing it
           //newObject.pop();
           const polyPoints = [];
           for (let p of newObject) {
             polyPoints.push(p);
             //polyPoints.push(p.y);
           }
           const polygon = {type: "Polygon", points: polyPoints}
           this.setState(prevState => ({
                drawing: "None",
                objectUnderCreation: [],
                MaskObjects: [...prevState.MaskObjects, polygon],
            }));
         }
         else {
           //Here, we might throw a notice
         };

         break;
       default:
         break;
     }
  }

  //Canvas object actions

  editPolygon(points,id) {
    const maskObjects = this.state.MaskObjects;
    //const polygon = maskObjects[id];
    maskObjects[id].points = points;
    this.setState(prevState => ({Maskobjects: maskObjects}));
  }



 //Canvas state functions
   addPolygonStart() {
       this.setState(prevState => ({drawing: "polygon"}));
   }



  zoomSelect(event, zoom) {
    //in the functions call from the zoom selector, zoom is e.target.value and
    //as o7 07/01/2019 a string!
    if (!this.state.image) {
      this.setState(prevState => ({zoom: 100}));
      return;
    }
    const newZoom = parseInt(zoom);
    const currentZoom = this.state.zoom;

    //We want the center of the view to stay the same
    var x =  -(newZoom/currentZoom - 1)*canvasWidth/2 + newZoom/currentZoom*this.state.x;
    var y =  -(newZoom/currentZoom - 1)*canvasHeight/2 + newZoom/currentZoom*this.state.y;

    var deltaY = 0;
    if (canvasHeight > this.state.image.height*currentZoom/100 &&
        canvasHeight < this.state.image.height*newZoom/100) {
      deltaY = 0.5;
    }
    else if (canvasHeight > this.state.image.height*newZoom/100) {
      y = 0;
      deltaY = 0;
    }
    else {
      deltaY  = (this.state.scrollY);
    }

    var deltaX = 0;
    if (canvasWidth > this.state.image.width*currentZoom/100 &&
        canvasWidth < this.state.image.width*newZoom/100) {
      deltaX = 0.5;
    }
    else if (canvasWidth > this.state.image.width*newZoom/100) {
      x = 0;
      deltaX = 0;
    }
    else {
      deltaX  = (this.state.scrollX);
    }

    this.setState(prevState => ({zoom: newZoom, scrollX: deltaX, scrollY: deltaY,
                                 x: x, y: y}));


  }

imageDragBox (pos) {
  //we only allow dragging if the object is larger than the canvas
  const imageWidth = this.state.image.width;
  const imageHeight = this.state.image.height;
  if (this.state.zoom*imageWidth/100 > canvasWidth) {
      pos.x = Math.floor(Math.max(Math.min(pos.x, -this.state.zoom*this.state.imageOffsetX/100), -this.state.zoom*(imageWidth+this.state.imageOffsetX)/100 + canvasWidth));
  }
  else {
    pos.x = 0;
  }
  if (this.state.zoom*imageHeight/100 > canvasHeight) {
    pos.y = Math.max(Math.min(pos.y, -this.state.zoom*this.state.imageOffsetY/100), -this.state.zoom*(imageHeight+this.state.imageOffsetY)/100 + canvasHeight);
  }
  else {
    pos.x = 0;
  }
  return pos;
}

moveImage(event) {
  //dragging the image actually should move the canvas...
  let imageWidth
  let imageHeight
  if (this.state.image) {
     imageWidth = this.state.image.width;
     imageHeight = this.state.image.height;
  }
  else {
    imageWidth = canvasWidth;
    imageHeight = canvasHeight;
  }
  const newScrollX = (event.target._lastPos.x + this.state.zoom*this.state.imageOffsetX/100)/(-this.state.zoom*imageWidth/100 + canvasWidth);
  const newScrollY = (event.target._lastPos.y +  this.state.zoom*this.state.imageOffsetY/100)/(-this.state.zoom*imageHeight/100 + canvasHeight);
  this.setState(prevState => ({scrollX: newScrollX, scrollY: newScrollY,
                               x: event.target._lastPos.x, y: event.target._lastPos.y}));
}

componentDidMount() {
  // important do that AFTER you added layer to a stage
  //console.log(this.mainLayer)
  const nativeCtx = this.mainLayer.current.getContext()._context;
  nativeCtx.webkitImageSmoothingEnabled = false;
  nativeCtx.mozImageSmoothingEnabled = false;
  nativeCtx.imageSmoothingEnabled = false;

   this.requestData();
}


  render() {
    let lines = [];
    if (this.state.objectUnderCreation.length > 1) {
      let point = this.state.objectUnderCreation[0];

      for (let p = 1; p <= this.state.objectUnderCreation.length-1; p++) {
        let newPoint = this.state.objectUnderCreation[p];
        lines.push([point.x, point.y, newPoint.x, newPoint.y]);
        point = newPoint;
      }
    }
    let polygons = [];
    for (let objectID in this.state.MaskObjects) {
      let object = this.state.MaskObjects[objectID];
      if (object.type === "Polygon") {
         polygons.push({points: object.points, id: objectID});
      }
    }

    let imageWidth
    let imageHeight
    if (this.state.image) {
       imageWidth = this.state.image.width;
       imageHeight = this.state.image.height;
    }
    else {
      imageWidth = canvasWidth;
      imageHeight = canvasHeight;
    }
    return (
      <div className="App">
        <div className="navbar">
             <ul className="navbar-nav mr-auto">

              <label form="sel1">Select Zoom:</label>
              <select  ref="setzoom"
                       value = {this.state.zoom}
                       onChange={(e) => {
                         this.zoomSelect(e,e.target.value);
                       }}>
                <option>100</option>
                <option>300</option>
                <option>600</option>
                <option>1200</option>
                <option>6000</option>

              </select>
              <div className="doubleRange">
                Min: {this.state.minInt} Max: {this.state.maxInt}
                <input className="minSlider" type="range" min={minCounts} max={maxCounts} step="1" value={this.state.minInt}
                      onChange={this.minIntChanged}/>
                <input className="maxSlider" type="range" min={minCounts} max={maxCounts} step="1" value={this.state.maxInt}
                       onChange={this.maxIntChanged}/>
              </div>
              </ul>

          </div>
          <Stage ref="canvas" className="canvascontainer"
                 width={canvasWidth} height={canvasHeight}
                 >
            <Layer ref={this.mainLayer}
                   scaleX={this.state.zoom/100}
                   scaleY={this.state.zoom/100}
                   y={this.state.y}
                   x={this.state.x}
                   draggable={true}
                   dragBoundFunc={this.imageDragBox}
                   onDragMove={this.moveImage}
                   >

               <Kimage

                    className="diffImage"
                    image={this.state.image}
                    y={this.state.imageOffsetY}
                    x={this.state.imageOffsetX}
                    width={imageWidth}
                    onMouseMove={this.canvasMouseMove}
                    onClick={this.canvasClick}
                 />



              {lines.map(line =>
                 <Line points={line}
                       stroke={"white"}
                       strokeWidth={100/this.state.zoom}/>)}

               {polygons.map(line =>
                  <Polygon points={line.points}
                           pointSize={200/this.state.zoom}
                           onMouseMove={this.canvasMouseMove}
                           onChange={points => this.editPolygon(points,line.id)}/>)}
              </Layer>


              <VerticalScrollBar height={canvasHeight-2*padding-scrollBarWidth}
                                 objectHeight={Math.floor(imageHeight*this.state.zoom/100)}
                                 scrollY={this.state.scrollY}
                                 x={canvasWidth-padding-scrollBarWidth}
                                 y={padding}
                                 barWidth={scrollBarWidth}
                                 onChange={this.verticalScroll}/>

              <HorizontalScrollBar width={canvasWidth-2*padding-scrollBarWidth}
                                   objectWidth={Math.floor(imageWidth*this.state.zoom/100)}
                                   scrollX={this.state.scrollX}
                                   x={padding}
                                   y={canvasHeight-padding-scrollBarWidth}
                                   barHeight={scrollBarWidth}
                                   onChange={this.horizontalScroll}/>


          </Stage>
          <div className="intensityBox">x: {Math.floor(this.state.posX)}, y: {Math.floor(this.state.posY)}, intensity: {this.state.intensity}</div>
          <div className="maskPanel">
            <Button onClick={this.addPolygonStart}> Add Polygon</Button>
          </div>
        <canvas ref="inputcanvas" width={canvasWidth} height={canvasHeight}
                className="hidden" />
      </div>
    );
  }
}


const Polygon = ({points,pointSize, onMouseMove, onChange}) =>
     <Group>
     <Line points={points.flatMap(point => [point.x,point.y])}
           closed={true}
           fill={'rgba(255, 255, 255, 0.3)'}
           onMouseMove={onMouseMove}/>
     {points.map((point,index) =>
      <Circle x={point.x} y = {point.y} radius={pointSize*2} fill={"white"}
              opacity={0}
              draggable={true}
              dragBoundFunc={function (pos) {
                  pos.x = point.x;
                  pos.y = point.y;
                  return pos;}}
              onDragMove={(e) => {
                e.cancelBubble = true;
              }}/>)}
      {points.map((point,index) =>
       <Circle x={point.x} y = {point.y} radius={pointSize} fill={"white"}
               draggable={true}
               onDragMove={(e) => {
                 e.cancelBubble = true
                 const newPoints = points;
                 const newX = (e.target.attrs.x);
                 const newY = (e.target.attrs.y);
                 newPoints[index] = {x: newX, y: newY}
                 onChange(newPoints);}}/>)}
      </Group>



const HorizontalScrollBar = ({width,objectWidth, x,y, scrollX, barHeight, onChange}) =>
      <Layer x={0} y={0}>
      <Rect width={width} height={barHeight} fill={"white"}
            opacity={0.9}
            x={x}
            y={y} draggable={false} />
      {  width < objectWidth &&
        (<Rect width={width*width/objectWidth} height={barHeight} fill={"blue"}
            opacity={0.3}
            x={scrollX*(width - width*width/objectWidth)+ x}
            y={y}
            draggable={true}
            dragBoundFunc={function (pos) {
                pos.x = Math.max(Math.min(pos.x, width - width*width/objectWidth), x);
                pos.y = y; return pos;}}
            onDragMove={(e) => {
                const barWidth = width*width/objectWidth
                const availableWidth= width - barWidth;
                if (availableWidth > 0) {
                  var delta = (e.target._lastPos.x) / availableWidth;
                  onChange(delta);}
                }}/>)
            }
      </Layer>



const VerticalScrollBar = ({height,objectHeight, x,y,scrollY, barWidth, onChange}) =>
      <Layer x={0} y={0}>
      <Rect width={barWidth} height={height} fill={"white"}
            opacity={0.9}
            x={x}
            y={y} draggable={false} />
      {  height < objectHeight &&
        (<Rect width={barWidth} height={height*height/objectHeight} fill={"blue"}
            opacity={0.3}
            x={x}
            y={scrollY*(height - height*height/objectHeight)+y}
            draggable={true}
            dragBoundFunc={function (pos) {
                pos.x = x;
                pos.y = Math.max(Math.min(pos.y, height - height*height/objectHeight), y);
                return pos;}}
            onDragMove={(e) => {
                const barHeight = height*height/objectHeight
                const availableHeight = height - barHeight;
                if (availableHeight > 0) {
                  var delta = (e.target._lastPos.y) / availableHeight;
                  onChange(delta);}
                }}/>)
            }
      </Layer>




export default App;
