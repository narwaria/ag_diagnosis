(function (Drupal, once) {
  Drupal.behaviors.agDiagnosis = {
    attach: function (context) {
      once('ag-diagnosis-init', 'body', context).forEach(function () {
        console.log('AG Diagnosis theme loaded.');
      });
    }
  };
})(Drupal, once);
