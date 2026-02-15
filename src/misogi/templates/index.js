/**
 * テンプレート管理
 * 
 * template_id から対応するテンプレートJSONを取得する
 */

import CLEAN_GREASE_TRAP_V1 from './CLEAN_GREASE_TRAP_V1.json';
import CLEAN_RANGE_HOOD_V1 from './CLEAN_RANGE_HOOD_V1.json';
import CLEAN_VENTILATION_FAN_V1 from './CLEAN_VENTILATION_FAN_V1.json';
import CLEAN_DUCT_V1 from './CLEAN_DUCT_V1.json';
import CLEAN_RANGE_HOOD_SIROCCO_V1 from './CLEAN_RANGE_HOOD_SIROCCO_V1.json';
import CLEAN_PIPE_PRESSURE_WASH_V1 from './CLEAN_PIPE_PRESSURE_WASH_V1.json';
import CLEAN_GRATING_V1 from './CLEAN_GRATING_V1.json';
import CLEAN_KITCHEN_EQUIPMENT_V1 from './CLEAN_KITCHEN_EQUIPMENT_V1.json';
import CLEAN_KITCHEN_WALL_V1 from './CLEAN_KITCHEN_WALL_V1.json';
import CLEAN_SINK_V1 from './CLEAN_SINK_V1.json';
import MAINT_EXHAUST_FAN_BELT_V1 from './MAINT_EXHAUST_FAN_BELT_V1.json';
import MAINT_FIRE_SHUTTER_V1 from './MAINT_FIRE_SHUTTER_V1.json';
import PEST_INSECT_CONTROL_V1 from './PEST_INSECT_CONTROL_V1.json';
import PEST_RODENT_CONTROL_V1 from './PEST_RODENT_CONTROL_V1.json';
import CLEAN_FLOOR_WAX_V1 from './CLEAN_FLOOR_WAX_V1.json';
import SALES_ACTIVITY_REPORT_V1 from './SALES_ACTIVITY_REPORT_V1.json';
import SIMPLE_FREE_INPUT_V1 from './SIMPLE_FREE_INPUT_V1.json';
import CLEANING_SHEETS_3_V1 from './CLEANING_SHEETS_3_V1.json';

// テンプレートマップ
const TEMPLATES = {
    'CLEAN_GREASE_TRAP_V1': CLEAN_GREASE_TRAP_V1,
    'CLEAN_RANGE_HOOD_V1': CLEAN_RANGE_HOOD_V1,
    'CLEAN_VENTILATION_FAN_V1': CLEAN_VENTILATION_FAN_V1,
    'CLEAN_DUCT_V1': CLEAN_DUCT_V1,
    'CLEAN_RANGE_HOOD_SIROCCO_V1': CLEAN_RANGE_HOOD_SIROCCO_V1,
    'CLEAN_PIPE_PRESSURE_WASH_V1': CLEAN_PIPE_PRESSURE_WASH_V1,
    'CLEAN_GRATING_V1': CLEAN_GRATING_V1,
    'CLEAN_KITCHEN_EQUIPMENT_V1': CLEAN_KITCHEN_EQUIPMENT_V1,
    'CLEAN_KITCHEN_WALL_V1': CLEAN_KITCHEN_WALL_V1,
    'CLEAN_SINK_V1': CLEAN_SINK_V1,
    'MAINT_EXHAUST_FAN_BELT_V1': MAINT_EXHAUST_FAN_BELT_V1,
    'MAINT_FIRE_SHUTTER_V1': MAINT_FIRE_SHUTTER_V1,
    'PEST_INSECT_CONTROL_V1': PEST_INSECT_CONTROL_V1,
    'PEST_RODENT_CONTROL_V1': PEST_RODENT_CONTROL_V1,
    'CLEAN_FLOOR_WAX_V1': CLEAN_FLOOR_WAX_V1,
    'SALES_ACTIVITY_REPORT_V1': SALES_ACTIVITY_REPORT_V1,
    'SIMPLE_FREE_INPUT_V1': SIMPLE_FREE_INPUT_V1,
    'CLEANING_SHEETS_3_V1': CLEANING_SHEETS_3_V1,
};

/**
 * template_id からテンプレートを取得
 * @param {string} templateId 
 * @returns {object|null}
 */
export const getTemplateById = (templateId) => {
    return TEMPLATES[templateId] || null;
};

/**
 * 登録されている全テンプレートIDのリストを取得
 * @returns {string[]}
 */
export const getTemplateIds = () => {
    return Object.keys(TEMPLATES);
};

/**
 * テンプレート一覧を取得（ID + タイトル）
 * @returns {Array<{id: string, title: string}>}
 */
export const getTemplateList = () => {
    return Object.entries(TEMPLATES).map(([id, tmpl]) => ({
        id,
        title: tmpl.title || id,
    }));
};

export default TEMPLATES;
