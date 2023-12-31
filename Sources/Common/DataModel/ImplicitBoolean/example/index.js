import '@kitware/vtk.js/favicon';

// Load the rendering pieces we want to use (for both WebGL and WebGPU)
import '@kitware/vtk.js/Rendering/Profiles/Geometry';

import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';
import vtkFullScreenRenderWindow from '@kitware/vtk.js/Rendering/Misc/FullScreenRenderWindow';
import vtkImageMarchingCubes from '@kitware/vtk.js/Filters/General/ImageMarchingCubes';
import vtkMapper from '@kitware/vtk.js/Rendering/Core/Mapper';
import vtkSampleFunction from '@kitware/vtk.js/Imaging/Hybrid/SampleFunction';
import vtkPlane from '@kitware/vtk.js/Common/DataModel/Plane';
import vtkCylinder from '@kitware/vtk.js/Common/DataModel/Cylinder';
import vtkImplicitBoolean from '@kitware/vtk.js/Common/DataModel/ImplicitBoolean';

import controlPanel from './controller.html';

const { Operation } = vtkImplicitBoolean;

// ----------------------------------------------------------------------------
// Standard rendering code setup
// ----------------------------------------------------------------------------

const fullScreenRenderer = vtkFullScreenRenderWindow.newInstance();
const renderer = fullScreenRenderer.getRenderer();
const renderWindow = fullScreenRenderer.getRenderWindow();

// ----------------------------------------------------------------------------
// Example code
// ----------------------------------------------------------------------------
const actor = vtkActor.newInstance();
renderer.addActor(actor);

const mapper = vtkMapper.newInstance();
actor.setMapper(mapper);

// Build pipeline. Boolean together some implicit functions and then sample, isosurface them
const pLeft = vtkPlane.newInstance({ normal: [-1, 0, 0], origin: [-5, 0, 0] });
const pRight = vtkPlane.newInstance({ normal: [1, 0, 0], origin: [5, 0, 0] });
const cyl = vtkCylinder.newInstance({
  radius: 0.5,
  center: [0, 0, 0],
  axis: [1, 0, 0],
});
const lCylCut = vtkImplicitBoolean.newInstance({
  operation: Operation.INTERSECTION,
  functions: [cyl, pLeft],
});
const rCylCut = vtkImplicitBoolean.newInstance({
  operation: Operation.INTERSECTION,
});
rCylCut.addFunction(lCylCut);
rCylCut.addFunction(pRight);

const sample = vtkSampleFunction.newInstance({
  implicitFunction: rCylCut,
  sampleDimensions: [50, 50, 50],
  modelBounds: [-7.5, 7.5, -1, 1, -1, 1],
});
const mCubes = vtkImageMarchingCubes.newInstance({ contourValue: 0.0 });

// Connect the pipeline proper
mCubes.setInputConnection(sample.getOutputPort());
mapper.setInputConnection(mCubes.getOutputPort());

// ----------------------------------------------------------------------------
// UI control handling
// ----------------------------------------------------------------------------
fullScreenRenderer.addController(controlPanel);

// Define the volume resolution
document.querySelector('.volumeResolution').addEventListener('input', (e) => {
  const value = Number(e.target.value);
  sample.setSampleDimensions(value, value, value);
  renderWindow.render();
});

// -----------------------------------------------------------

renderer.resetCamera();
renderWindow.render();

// -----------------------------------------------------------
// Make some variables global so that you can inspect and
// modify objects in your browser's developer console:
// -----------------------------------------------------------

global.source = sample;
global.filter = mCubes;
global.mapper = mapper;
global.actor = actor;
