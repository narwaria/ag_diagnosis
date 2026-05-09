(function (Drupal, once) {
  Drupal.behaviors.agDiagnosis = {
    attach: function (context) {
      once('ag-diagnosis-init', 'body', context);
    }
  };
})(Drupal, once);
