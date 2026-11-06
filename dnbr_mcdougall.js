// dNBR burn severity – McDougall Creek fire (West Kelowna, BC), Aug 2023

// 1. Area of interest
var aoi = ee.Geometry.Rectangle([-119.75, 49.82, -119.40, 50.02]);
Map.centerObject(aoi, 11);

// 2. Landsat 8 + 9, cloud-masked and scaled
function prep(img) {
  var qa = img.select('QA_PIXEL');
  var clear = qa.bitwiseAnd(1 << 3).eq(0)
              .and(qa.bitwiseAnd(1 << 4).eq(0));
  var sr = img.select('SR_B.').multiply(0.0000275).add(-0.2);
  return sr.updateMask(clear).copyProperties(img, ['system:time_start']);
}

var landsat = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
  .merge(ee.ImageCollection('LANDSAT/LC09/C02/T1_L2'))
  .filterBounds(aoi)
  .map(prep);

// 3. Pre- and post-fire composites
var pre  = landsat.filterDate('2023-06-15', '2023-08-10').median().clip(aoi);
var post = landsat.filterDate('2023-09-01', '2023-10-31').median().clip(aoi);

// 4. NBR = (NIR - SWIR2) / (NIR + SWIR2)
var preNBR  = pre.normalizedDifference(['SR_B5', 'SR_B7']).rename('NBR');
var postNBR = post.normalizedDifference(['SR_B5', 'SR_B7']).rename('NBR');

// 5. dNBR = pre - post
var dNBR = preNBR.subtract(postNBR).rename('dNBR');

// 6. Severity classes (USGS thresholds)
var severity = ee.Image(0)
  .where(dNBR.gte(0.10), 1)
  .where(dNBR.gte(0.27), 2)
  .where(dNBR.gte(0.44), 3)
  .where(dNBR.gte(0.66), 4)
  .updateMask(dNBR.mask())
  .rename('severity');

// 7. Display
var rgb = {bands: ['SR_B4', 'SR_B3', 'SR_B2'], min: 0, max: 0.25};
Map.addLayer(pre,  rgb, 'Pre-fire true colour', false);
Map.addLayer(post, rgb, 'Post-fire true colour', false);
Map.addLayer(dNBR, {min: -0.1, max: 0.8, palette: ['green', 'yellow', 'orange', 'red', 'purple']}, 'dNBR');
Map.addLayer(severity, {min: 0, max: 4, palette: ['1a9850', 'ffffbf', 'fdae61', 'f46d43', 'a50026']}, 'Burn severity classes');

// 8. Hectares per severity class
var areaByClass = ee.Image.pixelArea().divide(1e4)
  .addBands(severity)
  .reduceRegion({
    reducer: ee.Reducer.sum().group({groupField: 1, groupName: 'class'}),
    geometry: aoi,
    scale: 30,
    maxPixels: 1e9
  });
print('Hectares per severity class (0 = unburned ... 4 = high)', areaByClass);
print('Images in pre window:',  landsat.filterDate('2023-06-15', '2023-08-10').size());
print('Images in post window:', landsat.filterDate('2023-09-01', '2023-10-31').size());
