import _defineProperty from '@babel/runtime/helpers/defineProperty';
import macro from '../../macros.js';
import vtkCellTypes from '../../Common/DataModel/CellTypes.js';
import vtkLine from '../../Common/DataModel/Line.js';
import vtkPicker from './Picker.js';
import vtkPolyLine from '../../Common/DataModel/PolyLine.js';
import vtkTriangle from '../../Common/DataModel/Triangle.js';
import vtkQuad from '../../Common/DataModel/Quad.js';
import { l as normalize } from '../../Common/Core/Math/index.js';
import { CellType } from '../../Common/DataModel/CellTypes/Constants.js';
import { vec3 } from 'gl-matrix';
import vtkBox from '../../Common/DataModel/Box.js';


function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
// Global methods
// ----------------------------------------------------------------------------

function createCellMap() {
  var _ref;

  return _ref = {}, _defineProperty(_ref, CellType.VTK_LINE, vtkLine.newInstance()), _defineProperty(_ref, CellType.VTK_POLY_LINE, vtkPolyLine.newInstance()), _defineProperty(_ref, CellType.VTK_TRIANGLE, vtkTriangle.newInstance()), _defineProperty(_ref, CellType.VTK_QUAD, vtkQuad.newInstance()), _ref;
}

function clipLineWithPlane(mapper, matrix, p1, p2) {
  var outObj = {
    planeId: -1,
    t1: 0.0,
    t2: 1.0,
    intersect: 0
  };
  var nbClippingPlanes = mapper.getNumberOfClippingPlanes();
  var plane = [];

  for (var i = 0; i < nbClippingPlanes; i++) {
    mapper.getClippingPlaneInDataCoords(matrix, i, plane);
    var d1 = plane[0] * p1[0] + plane[1] * p1[1] + plane[2] * p1[2] + plane[3];
    var d2 = plane[0] * p2[0] + plane[1] * p2[1] + plane[2] * p2[2] + plane[3]; // If both distances are negative, both points are outside

    if (d1 < 0 && d2 < 0) {
      return 0;
    }

    if (d1 < 0 || d2 < 0) {
      // If only one of the distances is negative, the line crosses the plane
      // Compute fractional distance "t" of the crossing between p1 & p2
      var t = 0.0; // The "if" here just avoids an expensive division when possible

      if (d1 !== 0) {
        // We will never have d1==d2 since they have different signs
        t = d1 / (d1 - d2);
      } // If point p1 was clipped, adjust t1


      if (d1 < 0) {
        if (t >= outObj.t1) {
          outObj.t1 = t;
          outObj.planeId = i;
        }
      } else if (t <= outObj.t2) {
        // else point p2 was clipped, so adjust t2
        outObj.t2 = t;
      } // If this happens, there's no line left


      if (outObj.t1 > outObj.t2) {
        outObj.intersect = 0;
        return outObj;
      }
    }
  }

  outObj.intersect = 1;
  return outObj;
} // ----------------------------------------------------------------------------
// Static API
// ----------------------------------------------------------------------------


var STATIC = {
  clipLineWithPlane: clipLineWithPlane
}; // ----------------------------------------------------------------------------
// vtkCellPicker methods
// ----------------------------------------------------------------------------

function vtkCellPicker(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkCellPicker');

  var superClass = _objectSpread({}, publicAPI);

  function resetCellPickerInfo() {
    model.cellId = -1;
    model.pCoords[0] = 0.0;
    model.pCoords[1] = 0.0;
    model.pCoords[2] = 0.0;
    model.cellIJK[0] = 0.0;
    model.cellIJK[1] = 0.0;
    model.cellIJK[2] = 0.0;
    model.mapperNormal[0] = 0.0;
    model.mapperNormal[1] = 0.0;
    model.mapperNormal[2] = 1.0;
    model.pickNormal[0] = 0.0;
    model.pickNormal[1] = 0.0;
    model.pickNormal[2] = 1.0;
  }

  function resetPickInfo() {
    model.dataSet = null;
    model.mapper = null;
    resetCellPickerInfo();
  }

  publicAPI.initialize = function () {
    resetPickInfo();
    superClass.initialize();
  };

  publicAPI.computeSurfaceNormal = function (data, cell, weights, normal) {
    var normals = data.getPointData().getNormals(); // TODO add getCellDimension on vtkCell

    if (normals) {
      normal[0] = 0.0;
      normal[1] = 0.0;
      normal[2] = 0.0;
      var pointNormal = [];

      for (var i = 0; i < 3; i++) {
        normals.getTuple(cell.getPointsIds()[i], pointNormal);
        normal[0] += pointNormal[0] * weights[i];
        normal[1] += pointNormal[1] * weights[i];
        normal[2] += pointNormal[2] * weights[i];
      }

      normalize(normal);
    } else {
      return 0;
    }

    return 1;
  };

  publicAPI.pick = function (selection, renderer) {
    publicAPI.initialize();
    var pickResult = superClass.pick(selection, renderer);

    if (pickResult) {
      var camera = renderer.getActiveCamera();
      var cameraPos = [];
      camera.getPosition(cameraPos);

      if (camera.getParallelProjection()) {
        // For parallel projection, use -ve direction of projection
        var cameraFocus = [];
        camera.getFocalPoint(cameraFocus);
        model.pickNormal[0] = cameraPos[0] - cameraFocus[0];
        model.pickNormal[1] = cameraPos[1] - cameraFocus[1];
        model.pickNormal[2] = cameraPos[2] - cameraFocus[2];
      } else {
        // Get the vector from pick position to the camera
        model.pickNormal[0] = cameraPos[0] - model.pickPosition[0];
        model.pickNormal[1] = cameraPos[1] - model.pickPosition[1];
        model.pickNormal[2] = cameraPos[2] - model.pickPosition[2];
      }

      normalize(model.pickNormal);
    }

    return pickResult;
  };

  publicAPI.intersectWithLine = function (p1, p2, tol, mapper) {
    var tMin = Number.MAX_VALUE;
    var t1 = 0.0;
    var t2 = 1.0;
    var vtkCellPickerPlaneTol = 1e-14;
    var clipLine = clipLineWithPlane(mapper, model.transformMatrix, p1, p2);

    if (mapper && !clipLine.intersect) {
      return Number.MAX_VALUE;
    }

    if (mapper.isA('vtkImageMapper') || mapper.isA('vtkImageArrayMapper')) {
      var pickData = mapper.intersectWithLineForCellPicking(p1, p2);

      if (pickData) {
        tMin = pickData.t;
        model.cellIJK = pickData.ijk;
        model.pCoords = pickData.pCoords;
      }
    } else if (mapper.isA('vtkMapper')) {
      tMin = publicAPI.intersectActorWithLine(p1, p2, t1, t2, tol, mapper);
    } else if (mapper.isA('vtkVolumeMapper')) {
      tMin = publicAPI.IntersectVolumeWithLine(p1, p2, t1, t2, tol, mapper);
    }

    if (tMin < model.globalTMin) {
      model.globalTMin = tMin;

      if (Math.abs(tMin - t1) < vtkCellPickerPlaneTol && clipLine.clippingPlaneId >= 0) {
        model.mapperPosition[0] = p1[0] * (1 - t1) + p2[0] * t1;
        model.mapperPosition[1] = p1[1] * (1 - t1) + p2[1] * t1;
        model.mapperPosition[2] = p1[2] * (1 - t1) + p2[2] * t1;
        var plane = [];
        mapper.getClippingPlaneInDataCoords(model.transformMatrix, clipLine.clippingPlaneId, plane);
        normalize(plane); // Want normal outward from the planes, not inward

        model.mapperNormal[0] = -plane[0];
        model.mapperNormal[1] = -plane[1];
        model.mapperNormal[2] = -plane[2];
      }

      vec3.transformMat4(model.pickPosition, model.mapperPosition, model.transformMatrix); // Transform vector

      var mat = model.transformMatrix;
      model.mapperNormal[0] = mat[0] * model.pickNormal[0] + mat[4] * model.pickNormal[1] + mat[8] * model.pickNormal[2];
      model.mapperNormal[1] = mat[1] * model.pickNormal[0] + mat[5] * model.pickNormal[1] + mat[9] * model.pickNormal[2];
      model.mapperNormal[2] = mat[2] * model.pickNormal[0] + mat[6] * model.pickNormal[1] + mat[10] * model.pickNormal[2];
    }

    return tMin;
  };

  publicAPI.ClipLineWithExtent = function (extent, x1, x2, t1, t2, planeId) {
      var bounds = new Array(6);
      bounds[0] = extent[0];
      bounds[1] = extent[1];
      bounds[2] = extent[2];
      bounds[3] = extent[3];
      bounds[4] = extent[4];
      bounds[5] = extent[5];

      var p2; 
      return vtkBox.IntersectWithLine(bounds, x1, x2, t1, t2, undefined, undefined, planeId, p2);
  }

  publicAPI.IntersectVolumeWithLine = function (p1, p2, t1, t2, tol, mapper) {
    var data = mapper.getInputData()

    if (data === undefined) {
      return 0
    }

    var spacing = data.getSpacing()
    var origin = data.getOrigin()
    var extent = data.getExtent()

    var x1 = []
    var x2 = []

    for (let i = 0; i < 3; i++) {
      let x1_data = (p1[i] - origin[i]) / spacing[i];
      let x2_data = (p2[i] - origin[i]) / spacing[i];
      x1.push(x1_data)
      x2.push(x2_data)
    }
    
    var planeId; 
    var resultData = publicAPI.ClipLineWithExtent(extent, x1, x2, t1, t2, planeId)
    console.log("Result Data = ", resultData);
  }

  publicAPI.intersectActorWithLine = function (p1, p2, t1, t2, tol, mapper) {
    var tMin = Number.MAX_VALUE;
    var minXYZ = [0, 0, 0];
    var pDistMin = Number.MAX_VALUE;
    var minPCoords = [0, 0, 0];
    var minCellId = null;
    var minCell = null;
    var minCellType = null;
    var subId = null;
    var x = [];
    var data = mapper.getInputData();

    var q1 = [0, 0, 0];
    var q2 = [0, 0, 0];
    q1[0] = p1[0];
    q1[1] = p1[1];
    q1[2] = p1[2];
    q2[0] = p2[0];
    q2[1] = p2[1];
    q2[2] = p2[2];

    if (t1 !== 0.0 || t2 !== 1.0) {
      for (var j = 0; j < 3; j++) {
        q1[j] = p1[j] * (1.0 - t1) + p2[j] * t1;
        q2[j] = p1[j] * (1.0 - t2) + p2[j] * t2;
      }
    }

    if (data.getCells) {
      if (!data.getCells()) {
        data.buildLinks();
      }

      var tempCellMap = createCellMap();
      var minCellMap = createCellMap();
      var numberOfCells = data.getNumberOfCells();
      /* eslint-disable no-continue */

      for (var cellId = 0; cellId < numberOfCells; cellId++) {
        var pCoords = [0, 0, 0];
        minCellType = data.getCellType(cellId); // Skip cells that are marked as empty

        if (minCellType === CellType.VTK_EMPTY_CELL) {
          continue;
        }

        var cell = tempCellMap[minCellType];

        if (cell == null) {
          continue;
        }

        minCell = minCellMap[minCellType];
        data.getCell(cellId, cell);
        var cellPicked = void 0;

        {
          if (vtkCellTypes.hasSubCells(minCellType)) {
            cellPicked = cell.intersectWithLine(t1, t2, p1, p2, tol, x, pCoords);
          } else {
            cellPicked = cell.intersectWithLine(p1, p2, tol, x, pCoords);
          }
        }

        if (cellPicked.intersect === 1 && cellPicked.t <= tMin + model.tolerance && cellPicked.t >= t1 && cellPicked.t <= t2) {
          var pDist = cell.getParametricDistance(pCoords);

          if (pDist < pDistMin || pDist === pDistMin && cellPicked.t < tMin) {
            tMin = cellPicked.t;
            pDistMin = pDist;
            subId = cellPicked.subId;
            minCellId = cellId;
            cell.deepCopy(minCell);

            for (var k = 0; k < 3; k++) {
              minXYZ[k] = x[k];
              minPCoords[k] = pCoords[k];
            }
          }
        }
      }
      /* eslint-enable no-continue */

    }

    if (minCellId >= 0 && tMin < model.globalTMin) {
      resetPickInfo();
      var nbPointsInCell = minCell.getNumberOfPoints();
      var weights = new Array(nbPointsInCell);

      for (var i = 0; i < nbPointsInCell; i++) {
        weights[i] = 0.0;
      }

      var point = [];

      if (vtkCellTypes.hasSubCells(minCellType)) {
        minCell.evaluateLocation(subId, minPCoords, point, weights);
      } else {
        minCell.evaluateLocation(minPCoords, point, weights);
      } // Return the polydata to the user


      model.dataSet = data;
      model.cellId = minCellId;
      model.pCoords[0] = minPCoords[0];
      model.pCoords[1] = minPCoords[1];
      model.pCoords[2] = minPCoords[2]; // Find the point with the maximum weight

      var maxWeight = 0;
      var iMaxWeight = -1;

      for (var _i = 0; _i < nbPointsInCell; _i++) {
        if (weights[_i] > maxWeight) {
          iMaxWeight = _i;
          maxWeight = weights[_i];
        }
      } // If maximum weight is found, use it to get the PointId


      if (iMaxWeight !== -1) {
        model.pointId = minCell.getPointsIds()[iMaxWeight];
      } // Set the mapper position


      model.mapperPosition[0] = minXYZ[0];
      model.mapperPosition[1] = minXYZ[1];
      model.mapperPosition[2] = minXYZ[2]; // Compute the normal

      if (!publicAPI.computeSurfaceNormal(data, minCell, weights, model.mapperNormal)) {
        // By default, the normal points back along view ray
        model.mapperNormal[0] = p1[0] - p2[0];
        model.mapperNormal[1] = p1[1] - p2[1];
        model.mapperNormal[2] = p1[2] - p2[2];
        normalize(model.mapperNormal);
      }
    }

    return tMin;
  };
} // ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------

var DEFAULT_VALUES = {
  cellId: -1,
  pCoords: [],
  cellIJK: [],
  pickNormal: [],
  mapperNormal: []
}; // ----------------------------------------------------------------------------

function extend(publicAPI, model) {
  var initialValues = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  Object.assign(model, DEFAULT_VALUES, initialValues); // Inheritance

  vtkPicker.extend(publicAPI, model, initialValues);
  macro.getArray(publicAPI, model, ['pickNormal', 'mapperNormal', 'pCoords', 'cellIJK']);
  macro.get(publicAPI, model, ['cellId']); // Object methods

  vtkCellPicker(publicAPI, model);
} // ----------------------------------------------------------------------------

var newInstance = macro.newInstance(extend, 'vtkCellPicker'); // ----------------------------------------------------------------------------

var vtkCellPicker$1 = _objectSpread({
  newInstance: newInstance,
  extend: extend
}, STATIC);

export { STATIC, vtkCellPicker$1 as default, extend, newInstance };
